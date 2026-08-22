"""Endpoints publicos: catalogo, busca, perfil e agenda dos profissionais."""

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbSession, OptionalUser
from app.models import (
    Booking,
    NotificationTrigger,
    BookingStatus,
    Category,
    City,
    Plan,
    Professional,
    ProfessionalStatus,
    Review,
    Service,
    professional_categories,
)
from app.schemas.booking import (
    AgendaOut,
    BookingCreate,
    BookingLookup,
    BookingOut,
    BookingReschedule,
)
from app.schemas.catalog import CategoryOut, CityOut, PlanOut, ReverseGeocodeOut
from app.schemas.common import Page
from app.schemas.professional import ProfessionalCard, ProfessionalPublic, ReviewIn, ReviewOut
from app.services.agenda import (
    build_agenda,
    can_client_change,
    change_deadline,
    slot_is_free,
)
from app.services.booking_code import new_booking_code
from app.services.clients import find_or_create_client
from app.core.security import preview_allows
from app.services.geocoding import cidade_mais_perto
from app.services.geocoding import reverse as reverse_geocode
from app.services.notifications import dispatch

router = APIRouter(tags=["publico"])


def _get_professional(db: DbSession, slug: str, *, preview: str | None = None) -> Professional:
    professional = db.scalar(
        select(Professional)
        .options(
            selectinload(Professional.categories),
            selectinload(Professional.services),
            selectinload(Professional.availabilities),
        )
        .where(Professional.slug == slug)
    )
    if not professional:
        raise HTTPException(status_code=404, detail="Profissional não encontrado.")
    if professional.status != ProfessionalStatus.ACTIVE and not preview_allows(
        preview, professional.id
    ):
        raise HTTPException(
            status_code=404, detail="Este perfil não está disponível de momento."
        )
    return professional


def _to_public(professional: Professional) -> ProfessionalPublic:
    data = ProfessionalPublic.model_validate(professional)
    data.services = [s for s in data.services if s.is_active]
    data.services.sort(key=lambda s: (s.sort_order, s.id))
    prices = [s.price_cents for s in data.services if s.price_cents > 0]
    data.price_from_cents = min(prices) if prices else None
    return data


# ----------------------------------------------------------------- catalogo ---
@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: DbSession) -> list[CategoryOut]:
    """Especialidades disponiveis, com a contagem de profissionais ativos."""
    counts = dict(
        db.execute(
            select(professional_categories.c.category_id, func.count())
            .join(Professional, Professional.id == professional_categories.c.professional_id)
            .where(Professional.status == ProfessionalStatus.ACTIVE)
            .group_by(professional_categories.c.category_id)
        ).all()
    )
    rows = db.scalars(
        select(Category)
        .where(Category.is_active.is_(True))
        .order_by(Category.sort_order, Category.name)
    ).all()

    result = []
    for row in rows:
        item = CategoryOut.model_validate(row)
        item.professional_count = counts.get(row.id, 0)
        result.append(item)
    return result


@router.get("/cities", response_model=list[CityOut])
def list_cities(
    db: DbSession,
    q: str | None = Query(default=None, description="Início do nome da localidade"),
    limit: int = Query(default=10, ge=1, le=50),
) -> list[CityOut]:
    """Autocomplete de cidades para o campo de localidade."""
    query = select(City)
    if q and q.strip():
        query = query.where(func.lower(City.name).like(q.strip().lower() + "%"))
    rows = db.scalars(query.order_by(City.population.desc()).limit(limit)).all()
    return [CityOut.model_validate(c) for c in rows]


@router.get("/cities/nearest", response_model=CityOut | None)
def nearest_city(
    db: DbSession,
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
) -> CityOut | None:
    """A localidade conhecida mais próxima de umas coordenadas.

    Ao contrário de ``/geocode/reverse``, não sai para fora: responde a partir
    da nossa própria tabela de localidades. Por isso pode ficar aberta a quem
    ainda não entrou — é ela que preenche o campo de localidade quando um
    visitante carrega em "usar a minha localização" na pesquisa.

    Devolver um nome que já existe na tabela é também o que interessa à
    pesquisa: uma freguesia inventada por um serviço externo poderia não
    corresponder a nada e devolver uma lista vazia.
    """
    cidade = cidade_mais_perto(db, lat, lng)
    return CityOut.model_validate(cidade) if cidade else None


@router.get("/geocode/reverse", response_model=ReverseGeocodeOut)
def geocode_reverse(
    db: DbSession,
    user: CurrentUser,
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
) -> ReverseGeocodeOut:
    """Preenche a morada a partir das coordenadas.

    Pede sessão iniciada: é uma ponte para um serviço externo com limite de
    cadência, e deixá-la aberta convidaria a que fosse usada como proxy.
    """
    return ReverseGeocodeOut(**reverse_geocode(db, lat, lng))


@router.get("/plans", response_model=list[PlanOut])
def list_plans(db: DbSession) -> list[PlanOut]:
    """Planos ativos, para a pagina publica de precos."""
    rows = db.scalars(
        select(Plan).where(Plan.is_active.is_(True)).order_by(Plan.sort_order, Plan.price_cents)
    ).all()
    return [PlanOut.model_validate(p) for p in rows]


# -------------------------------------------------------------------- busca ---
class SearchResponse(Page[ProfessionalCard]):
    matched_city: CityOut | None = None
    radius_km: float | None = None
    # True quando nao havia ninguem na localidade pedida.
    expanded: bool = False
    # Distancia do resultado mais proximo, em km.
    nearest_km: float | None = None
    # Quantos ha em cada camada, para os cabecalhos de seccao.
    region_total: int = 0
    elsewhere_total: int = 0
    featured_total: int = 0


@router.get("/search", response_model=SearchResponse)
def search(
    db: DbSession,
    q: str | None = Query(default=None, description="Serviço, especialidade ou nome"),
    category: str | None = Query(default=None, description="Identificador da categoria"),
    city: str | None = Query(default=None, description="Localidade ou 'Localidade, Distrito'"),
    state: str | None = Query(default=None, max_length=60, description="Distrito"),
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    radius_km: float | None = Query(default=None, gt=0, le=300),
    at_home: bool | None = Query(default=None, description="Apenas quem se desloca ao domicílio"),
    max_price_cents: int | None = Query(default=None, ge=0),
    featured: bool | None = Query(default=None, description="Apenas perfis em destaque"),
    sort: str = Query(default="relevance", pattern="^(relevance|distance|rating|price|newest)$"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=12, ge=1, le=48),
) -> SearchResponse:
    """Busca principal do marketplace, ordenada por proximidade quando ha localidade."""
    from app.services.search import DEFAULT_RADIUS_KM, search_professionals

    outcome = search_professionals(
        db,
        q=q,
        category=category,
        city=city,
        state=state,
        lat=lat,
        lng=lng,
        radius_km=radius_km,
        at_home=at_home,
        max_price_cents=max_price_cents,
        featured=featured,
        sort=sort,
        page=page,
        per_page=per_page,
    )

    cards = []
    for hit in outcome.items:
        card = ProfessionalCard.model_validate(hit.professional)
        card.distance_km = round(hit.distance_km, 1) if hit.distance_km is not None else None
        card.price_from_cents = hit.price_from_cents
        card.group = hit.group
        cards.append(card)

    return SearchResponse(
        items=cards,
        total=outcome.total,
        page=page,
        per_page=per_page,
        pages=max((outcome.total + per_page - 1) // per_page, 1),
        matched_city=(
            CityOut.model_validate(outcome.matched_city) if outcome.matched_city else None
        ),
        radius_km=radius_km or DEFAULT_RADIUS_KM,
        expanded=outcome.expanded,
        nearest_km=round(outcome.nearest_km, 1) if outcome.nearest_km is not None else None,
        region_total=outcome.region_total,
        elsewhere_total=outcome.elsewhere_total,
        featured_total=outcome.featured_total,
    )


@router.get("/professionals/featured", response_model=list[ProfessionalCard])
def featured(db: DbSession, limit: int = Query(default=8, ge=1, le=24)) -> list[ProfessionalCard]:
    """Vitrine da home: destaques primeiro, depois melhor avaliados."""
    rows = db.scalars(
        select(Professional)
        .options(selectinload(Professional.categories))
        .where(Professional.status == ProfessionalStatus.ACTIVE)
        .order_by(
            Professional.is_featured.desc(),
            Professional.rating_avg.desc(),
            Professional.rating_count.desc(),
        )
        .limit(limit)
    ).unique().all()

    ids = [p.id for p in rows]
    prices = {}
    if ids:
        prices = dict(
            db.execute(
                select(Service.professional_id, func.min(Service.price_cents))
                .where(Service.professional_id.in_(ids), Service.is_active.is_(True))
                .group_by(Service.professional_id)
            ).all()
        )

    cards = []
    for professional in rows:
        card = ProfessionalCard.model_validate(professional)
        card.price_from_cents = prices.get(professional.id)
        cards.append(card)
    return cards


# ---------------------------------------------------------- perfil publico ---
@router.get("/professionals/{slug}", response_model=ProfessionalPublic)
def professional_detail(
    slug: str,
    db: DbSession,
    preview: str | None = Query(default=None, description="Autorização de pré-visualização"),
) -> ProfessionalPublic:
    """O perfil público, ou o perfil por aprovar quando há autorização.

    A pré-visualização não conta visita: quem está a rever um perfil não é
    tráfego, e inflar o contador do profissional com as voltas da administração
    seria mentir-lhe no painel.
    """
    professional = _get_professional(db, slug, preview=preview)
    if professional.status != ProfessionalStatus.ACTIVE:
        return _to_public(professional)

    professional.profile_views = (professional.profile_views or 0) + 1
    db.commit()
    db.refresh(professional)
    return _to_public(professional)


@router.get("/professionals/{slug}/reviews", response_model=list[ReviewOut])
def professional_reviews(
    slug: str,
    db: DbSession,
    limit: int = Query(default=20, ge=1, le=100),
    preview: str | None = Query(default=None),
) -> list[ReviewOut]:
    professional = _get_professional(db, slug, preview=preview)
    rows = db.scalars(
        select(Review)
        .where(Review.professional_id == professional.id, Review.is_published.is_(True))
        .order_by(Review.created_at.desc())
        .limit(limit)
    ).all()
    return [ReviewOut.model_validate(r) for r in rows]


# ---------------------------------------------------------- agenda publica ---
@router.get("/professionals/{slug}/agenda", response_model=AgendaOut)
def professional_agenda(
    slug: str,
    db: DbSession,
    service_id: int | None = Query(default=None),
    date_from: date | None = Query(default=None),
    days: int = Query(default=14, ge=1, le=62),
    preview: str | None = Query(default=None),
) -> AgendaOut:
    """Horarios livres do profissional, prontos para reserva."""
    professional = _get_professional(db, slug, preview=preview)

    duration = professional.slot_interval_min or 30
    if service_id is not None:
        service = db.get(Service, service_id)
        if not service or service.professional_id != professional.id or not service.is_active:
            raise HTTPException(status_code=404, detail="Serviço não encontrado.")
        duration = service.duration_min

    start = date_from or datetime.now(timezone.utc).date()
    return build_agenda(
        db,
        professional,
        date_from=start,
        date_to=start + timedelta(days=days - 1),
        duration_min=duration,
        service_id=service_id,
    )


# ------------------------------------------------------------- agendamento ---
@router.post(
    "/professionals/{slug}/bookings",
    response_model=BookingOut,
    status_code=status.HTTP_201_CREATED,
)
def create_booking(
    slug: str, payload: BookingCreate, db: DbSession, user: OptionalUser
) -> BookingOut:
    """Reserva um horario. Funciona com ou sem conta."""
    professional = _get_professional(db, slug)

    # Um profissional não se marca a si próprio. O horário ficava ocupado sem
    # que houvesse atendimento nenhum, a faturação contava um valor que ninguém
    # pagou, e o aviso automático saía do WhatsApp dele para o WhatsApp dele.
    # Para bloquear tempo há a folga, no ecrã de horários.
    if user is not None and professional.user_id == user.id:
        raise HTTPException(
            status_code=400,
            detail="Não pode marcar consigo mesmo. Para reservar este tempo, "
            "bloqueie o período em Configurações › Horários.",
        )

    service = db.get(Service, payload.service_id)
    if not service or service.professional_id != professional.id or not service.is_active:
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")

    if payload.at_home and not professional.serves_at_home:
        raise HTTPException(
            status_code=400, detail="Este profissional não faz deslocações ao domicílio."
        )
    if payload.at_home and not payload.address_line:
        raise HTTPException(
            status_code=400, detail="Indique a morada para o atendimento ao domicílio."
        )

    starts_at = payload.starts_at
    if starts_at.tzinfo is None:
        starts_at = starts_at.replace(tzinfo=timezone.utc)
    starts_at = starts_at.astimezone(timezone.utc)
    ends_at = starts_at + timedelta(minutes=service.duration_min)

    ok, reason = slot_is_free(db, professional, starts_at, ends_at)
    if not ok:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=reason)

    # Cada reserva alimenta a agenda de contatos do profissional: se ja houver
    # uma ficha com este telefone, ela e reaproveitada em vez de duplicar.
    client_record = find_or_create_client(
        db,
        professional.id,
        name=payload.client_name,
        phone=payload.client_phone,
        email=payload.client_email or (user.email if user else None),
        user_id=user.id if user else None,
        from_booking=True,
    )

    booking = Booking(
        code=new_booking_code(db),
        professional_id=professional.id,
        service_id=service.id,
        professional_client_id=client_record.id,
        client_id=user.id if user else None,
        client_name=payload.client_name.strip(),
        client_phone=payload.client_phone.strip(),
        client_email=(payload.client_email or (user.email if user else None)),
        starts_at=starts_at,
        ends_at=ends_at,
        status=(
            BookingStatus.CONFIRMED if professional.auto_confirm else BookingStatus.PENDING
        ),
        service_name=service.name,
        price_cents=service.price_cents,
        at_home=payload.at_home,
        address_line=payload.address_line,
        notes=payload.notes,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    # Confirmação automática já é uma confirmação; o pedido não chegou a existir.
    gatilho = (
        NotificationTrigger.BOOKING_CONFIRMED
        if booking.status == BookingStatus.CONFIRMED
        else NotificationTrigger.BOOKING_REQUESTED
    )
    dispatch(db, booking, gatilho, professional=professional)

    return BookingOut.model_validate(booking)


def _booking_por_codigo(db: DbSession, code: str) -> tuple[Booking, Professional]:
    booking = db.scalar(select(Booking).where(Booking.code == code.upper().strip()))
    if not booking:
        raise HTTPException(status_code=404, detail="Marcação não encontrada.")
    professional = db.get(Professional, booking.professional_id)
    if not professional:
        raise HTTPException(status_code=404, detail="Marcação não encontrada.")
    return booking, professional


def _lookup(db: DbSession, booking: Booking, professional: Professional) -> BookingLookup:
    pode, motivo = can_client_change(professional, booking)
    saida = BookingLookup.model_validate(booking)
    saida.professional_slug = professional.slug
    saida.professional_name = professional.display_name
    saida.professional_whatsapp = professional.whatsapp or professional.public_phone
    saida.can_change = pode
    saida.change_blocked_reason = motivo or None
    saida.change_deadline = change_deadline(professional, booking)
    saida.cancel_notice_hours = max(0, int(professional.cancel_notice_hours or 0))

    ja = db.scalar(select(Review.id).where(Review.booking_id == booking.id)) is not None
    saida.already_reviewed = ja
    saida.can_review = booking.status == BookingStatus.COMPLETED and not ja
    return saida


@router.get("/bookings/{code}", response_model=BookingLookup)
def booking_by_code(code: str, db: DbSession) -> BookingLookup:
    """Consulta de marcação pelo código, para quem reservou sem conta."""
    booking, professional = _booking_por_codigo(db, code)
    return _lookup(db, booking, professional)


@router.post("/bookings/{code}/cancel", response_model=BookingLookup)
def cancel_booking(code: str, db: DbSession) -> BookingLookup:
    """Cancelamento pelo próprio cliente, dentro do prazo do profissional."""
    booking, professional = _booking_por_codigo(db, code)

    pode, motivo = can_client_change(professional, booking)
    if not pode:
        raise HTTPException(status_code=409, detail=motivo)

    booking.status = BookingStatus.CANCELLED
    booking.cancel_reason = "Cancelado pelo cliente."
    db.commit()
    db.refresh(booking)

    dispatch(db, booking, NotificationTrigger.BOOKING_CANCELLED, professional=professional)
    return _lookup(db, booking, professional)


@router.patch("/bookings/{code}", response_model=BookingLookup)
def reschedule_booking(code: str, payload: BookingReschedule, db: DbSession) -> BookingLookup:
    """Remarcação pelo próprio cliente, para outro horário livre.

    A duração é a que já estava: remarcar é mudar a hora, não o serviço. E o
    horário novo passa pelas mesmas regras de um horário pedido de raiz — o
    prazo de alteração diz respeito ao horário antigo, não abre exceções no
    novo.
    """
    booking, professional = _booking_por_codigo(db, code)

    pode, motivo = can_client_change(professional, booking)
    if not pode:
        raise HTTPException(status_code=409, detail=motivo)

    duracao = booking.ends_at - booking.starts_at
    inicio = payload.starts_at
    if inicio.tzinfo is None:
        inicio = inicio.replace(tzinfo=timezone.utc)
    inicio = inicio.astimezone(timezone.utc)

    if inicio == booking.starts_at:
        return _lookup(db, booking, professional)

    livre, razao = slot_is_free(
        db, professional, inicio, inicio + duracao, exclude_booking_id=booking.id
    )
    if not livre:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=razao)

    booking.starts_at = inicio
    booking.ends_at = inicio + duracao
    # Uma remarcação volta a precisar do aval de quem atende, a não ser que o
    # profissional aceite marcações automaticamente.
    booking.status = (
        BookingStatus.CONFIRMED if professional.auto_confirm else BookingStatus.PENDING
    )
    db.commit()
    db.refresh(booking)

    dispatch(db, booking, NotificationTrigger.BOOKING_REQUESTED, professional=professional)
    return _lookup(db, booking, professional)


@router.post("/professionals/{slug}/reviews", response_model=ReviewOut, status_code=201)
def create_review(slug: str, payload: ReviewIn, db: DbSession) -> ReviewOut:
    """Avaliacao liberada apenas para quem tem um atendimento concluido."""
    professional = _get_professional(db, slug)

    booking = db.scalar(
        select(Booking).where(
            Booking.code == payload.booking_code.upper().strip(),
            Booking.professional_id == professional.id,
        )
    )
    if not booking:
        raise HTTPException(
            status_code=404, detail="Código de marcação inválido para este profissional."
        )
    if booking.status != BookingStatus.COMPLETED:
        raise HTTPException(
            status_code=400, detail="Só é possível avaliar depois de o atendimento estar concluído."
        )
    if db.scalar(select(Review.id).where(Review.booking_id == booking.id)):
        raise HTTPException(status_code=409, detail="Este atendimento já foi avaliado.")

    review = Review(
        professional_id=professional.id,
        booking_id=booking.id,
        author_id=booking.client_id,
        author_name=booking.client_name,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(review)
    db.flush()

    # Recalcula a media a partir das avaliacoes publicadas.
    avg, count = db.execute(
        select(func.avg(Review.rating), func.count(Review.id)).where(
            Review.professional_id == professional.id, Review.is_published.is_(True)
        )
    ).one()
    professional.rating_avg = round(float(avg or 0), 2)
    professional.rating_count = int(count or 0)

    db.commit()
    db.refresh(review)
    return ReviewOut.model_validate(review)
