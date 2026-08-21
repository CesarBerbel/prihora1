"""Painel do profissional: perfil, servicos, agenda, agendamentos e plano."""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentProfessional, CurrentUser, DbSession
from app.models import (
    Availability,
    Booking,
    BookingStatus,
    Category,
    Expense,
    Plan,
    Professional,
    ProfessionalStatus,
    Service,
    Subscription,
    TimeOff,
)
from app.models import ProfessionalClient, phone_digits
from app.models.enums import SubscriptionStatus
from app.schemas.admin import ChangePlanRequest, SubscriptionOut
from app.schemas.booking import (
    BookingOut,
    BookingStatusUpdate,
    BookingWithProfessional,
    InternalBookingCreate,
    StatusChangePreview,
)
from app.schemas.client import ClientDetail, ClientOut, ClientUpsert
from app.schemas.catalog import PlanOut
from app.schemas.common import Message, Page
from app.schemas.finance import (
    CommissionIn,
    DiaOut,
    ExpenseIn,
    ExpenseOut,
    FinanceSummaryOut,
    LinhaOut,
)
from app.schemas.professional import (
    AvailabilityBulk,
    AvailabilityOut,
    ProfessionalPrivate,
    ProfessionalUpdate,
    ServiceOut,
    ServiceSuggestion,
    ServiceUpsert,
    TimeOffIn,
    TimeOffOut,
)
from app.services.agenda import bookings_in_window, has_booking_conflict
from app.services.finance import (
    EXPENSE_CATEGORIES,
    despesas_do_mes,
    month_bounds,
    resumo_do_mes,
)
from app.services.booking_code import new_booking_code
from app.services.clients import client_summary, find_or_create_client
from app.services.notifications import dispatch, preview, trigger_for_status
from app.services.templates import TRIGGER_LABELS
from app.services.media import UploadError, delete_avatar, save_avatar
from app.services.slug import unique_professional_slug
from app.services.suggestions import suggestions_for

router = APIRouter(prefix="/me", tags=["profissional"])


def _load_full(db: DbSession, professional_id: int) -> Professional:
    return db.scalar(
        select(Professional)
        .options(
            selectinload(Professional.categories),
            selectinload(Professional.services),
            selectinload(Professional.availabilities),
        )
        .where(Professional.id == professional_id)
    )


def _private(db: DbSession, professional: Professional) -> ProfessionalPrivate:
    full = _load_full(db, professional.id)
    data = ProfessionalPrivate.model_validate(full)
    data.services.sort(key=lambda s: (s.sort_order, s.id))
    prices = [s.price_cents for s in data.services if s.is_active and s.price_cents > 0]
    data.price_from_cents = min(prices) if prices else None

    subscription = db.scalar(
        select(Subscription).where(Subscription.professional_id == professional.id)
    )
    data.plan = PlanOut.model_validate(subscription.plan) if subscription else None
    return data


def _plan_of(db: DbSession, professional_id: int) -> Plan | None:
    subscription = db.scalar(
        select(Subscription).where(Subscription.professional_id == professional_id)
    )
    return subscription.plan if subscription else None


# ------------------------------------------------------------------ perfil ---
@router.get("/professional", response_model=ProfessionalPrivate)
def get_my_profile(professional: CurrentProfessional, db: DbSession) -> ProfessionalPrivate:
    return _private(db, professional)


@router.put("/professional", response_model=ProfessionalPrivate)
def update_my_profile(
    payload: ProfessionalUpdate, professional: CurrentProfessional, db: DbSession
) -> ProfessionalPrivate:
    data = payload.model_dump(exclude_unset=True)
    category_ids = data.pop("category_ids", None)
    publish = data.pop("publish", None)

    if data.get("state"):
        # Distrito é nome próprio: "Lisboa", não "LISBOA".
        data["state"] = data["state"].strip()

    new_name = data.get("display_name")
    if new_name and new_name.strip() != professional.display_name:
        professional.slug = unique_professional_slug(db, new_name, exclude_id=professional.id)

    for field, value in data.items():
        setattr(professional, field, value)

    if category_ids is not None:
        professional.categories = list(
            db.scalars(select(Category).where(Category.id.in_(category_ids))).all()
        )

    if publish is not None:
        if publish:
            # Perfil suspenso pelo admin nao volta ao ar sozinho.
            if professional.status == ProfessionalStatus.SUSPENDED:
                raise HTTPException(
                    status_code=403,
                    detail="Perfil suspenso. Fale connosco para o reativar.",
                )
            missing = []
            if not professional.city:
                missing.append("cidade")
            if not db.scalar(
                select(Service.id).where(
                    Service.professional_id == professional.id, Service.is_active.is_(True)
                )
            ):
                missing.append("pelo menos um serviço ativo")
            if not db.scalar(
                select(Availability.id).where(Availability.professional_id == professional.id)
            ):
                missing.append("pelo menos um horário de atendimento")
            if missing:
                raise HTTPException(
                    status_code=400,
                    detail="Antes de publicar, preencha: " + ", ".join(missing) + ".",
                )
            professional.status = ProfessionalStatus.ACTIVE
        elif professional.status != ProfessionalStatus.SUSPENDED:
            professional.status = ProfessionalStatus.INACTIVE

    db.commit()
    return _private(db, professional)


# ------------------------------------------------------------ foto do perfil ---
@router.post("/avatar", response_model=ProfessionalPrivate)
async def upload_avatar(
    professional: CurrentProfessional,
    db: DbSession,
    file: UploadFile = File(..., description="JPG, PNG ou WEBP, já recortado em quadrado"),
) -> ProfessionalPrivate:
    """Recebe a foto recortada pelo navegador e publica no perfil."""
    raw = await file.read()

    try:
        url = save_avatar(raw, professional.id)
    except UploadError as error:
        raise HTTPException(status_code=400, detail=str(error))

    previous = professional.avatar_url
    professional.avatar_url = url
    db.commit()

    # So apaga a antiga depois que a nova ja esta gravada e referenciada.
    delete_avatar(previous)

    return _private(db, professional)


@router.delete("/avatar", response_model=ProfessionalPrivate)
def remove_avatar(professional: CurrentProfessional, db: DbSession) -> ProfessionalPrivate:
    """Remove a foto. O perfil volta a exibir o avatar com as iniciais."""
    previous = professional.avatar_url
    professional.avatar_url = None
    db.commit()

    delete_avatar(previous)
    return _private(db, professional)

# ---------------------------------------------------------------- servicos ---
@router.get("/services", response_model=list[ServiceOut])
def list_my_services(professional: CurrentProfessional, db: DbSession) -> list[ServiceOut]:
    rows = db.scalars(
        select(Service)
        .where(Service.professional_id == professional.id)
        .order_by(Service.sort_order, Service.id)
    ).all()
    return [ServiceOut.model_validate(s) for s in rows]


@router.get("/services/suggestions", response_model=list[ServiceSuggestion])
def service_suggestions(
    professional: CurrentProfessional, db: DbSession
) -> list[ServiceSuggestion]:
    """Serviços de exemplo para as especialidades escolhidas."""
    return [ServiceSuggestion(**s) for s in suggestions_for(db, professional)]


@router.post("/services", response_model=ServiceOut, status_code=status.HTTP_201_CREATED)
def create_service(
    payload: ServiceUpsert, professional: CurrentProfessional, db: DbSession
) -> ServiceOut:
    plan = _plan_of(db, professional.id)
    if plan:
        current = db.scalar(
            select(func.count(Service.id)).where(Service.professional_id == professional.id)
        )
        if current >= plan.max_services:
            raise HTTPException(
                status_code=402,
                detail=(
                    f"O plano {plan.name} permite até {plan.max_services} serviços. "
                    "Mude de plano para registar mais."
                ),
            )

    service = Service(professional_id=professional.id, **payload.model_dump())
    db.add(service)
    db.commit()
    db.refresh(service)
    return ServiceOut.model_validate(service)


@router.put("/services/{service_id}", response_model=ServiceOut)
def update_service(
    service_id: int, payload: ServiceUpsert, professional: CurrentProfessional, db: DbSession
) -> ServiceOut:
    service = db.get(Service, service_id)
    if not service or service.professional_id != professional.id:
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")
    for field, value in payload.model_dump().items():
        setattr(service, field, value)
    db.commit()
    db.refresh(service)
    return ServiceOut.model_validate(service)


@router.delete("/services/{service_id}", response_model=Message)
def delete_service(
    service_id: int, professional: CurrentProfessional, db: DbSession
) -> Message:
    service = db.get(Service, service_id)
    if not service or service.professional_id != professional.id:
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")

    # Servico com historico e apenas desativado, para nao quebrar agendamentos.
    has_history = db.scalar(select(Booking.id).where(Booking.service_id == service.id))
    if has_history:
        service.is_active = False
        db.commit()
        return Message(detail="Serviço desativado: tem marcações no histórico.")

    db.delete(service)
    db.commit()
    return Message(detail="Serviço removido.")


# ------------------------------------------------------------------ agenda ---
@router.get("/availability", response_model=list[AvailabilityOut])
def get_availability(professional: CurrentProfessional, db: DbSession) -> list[AvailabilityOut]:
    rows = db.scalars(
        select(Availability)
        .where(Availability.professional_id == professional.id)
        .order_by(Availability.weekday, Availability.start_time)
    ).all()
    return [AvailabilityOut.model_validate(a) for a in rows]


@router.put("/availability", response_model=list[AvailabilityOut])
def set_availability(
    payload: AvailabilityBulk, professional: CurrentProfessional, db: DbSession
) -> list[AvailabilityOut]:
    """Substitui a grade semanal inteira."""
    seen: set[tuple[int, str]] = set()
    for item in payload.items:
        if item.end_time <= item.start_time:
            raise HTTPException(
                status_code=400,
                detail="A hora de fim tem de ser posterior à de início.",
            )
        key = (item.weekday, item.start_time.isoformat())
        if key in seen:
            raise HTTPException(
                status_code=400, detail="Há períodos repetidos no mesmo dia e hora."
            )
        seen.add(key)

    db.query(Availability).filter(Availability.professional_id == professional.id).delete()
    for item in payload.items:
        db.add(
            Availability(
                professional_id=professional.id,
                weekday=item.weekday,
                start_time=item.start_time,
                end_time=item.end_time,
            )
        )
    db.commit()
    return get_availability(professional, db)


@router.get("/time-off", response_model=list[TimeOffOut])
def list_time_off(professional: CurrentProfessional, db: DbSession) -> list[TimeOffOut]:
    rows = db.scalars(
        select(TimeOff)
        .where(
            TimeOff.professional_id == professional.id,
            TimeOff.ends_at >= datetime.now(timezone.utc) - timedelta(days=30),
        )
        .order_by(TimeOff.starts_at)
    ).all()
    return [TimeOffOut.model_validate(t) for t in rows]


@router.post("/time-off", response_model=TimeOffOut, status_code=status.HTTP_201_CREATED)
def create_time_off(
    payload: TimeOffIn, professional: CurrentProfessional, db: DbSession
) -> TimeOffOut:
    if payload.ends_at <= payload.starts_at:
        raise HTTPException(status_code=400, detail="O fim do bloqueio tem de ser depois do início.")
    block = TimeOff(professional_id=professional.id, **payload.model_dump())
    db.add(block)
    db.commit()
    db.refresh(block)
    return TimeOffOut.model_validate(block)


@router.delete("/time-off/{block_id}", response_model=Message)
def delete_time_off(block_id: int, professional: CurrentProfessional, db: DbSession) -> Message:
    block = db.get(TimeOff, block_id)
    if not block or block.professional_id != professional.id:
        raise HTTPException(status_code=404, detail="Bloqueio não encontrado.")
    db.delete(block)
    db.commit()
    return Message(detail="Bloqueio removido.")


# ----------------------------------------------------------- agendamentos ---
@router.get("/bookings", response_model=list[BookingOut])
def list_my_bookings(
    professional: CurrentProfessional,
    db: DbSession,
    status_filter: BookingStatus | None = Query(default=None, alias="status"),
    upcoming: bool = Query(default=False, description="Apenas as próximas"),
    inicio: datetime | None = Query(default=None, alias="from"),
    fim: datetime | None = Query(default=None, alias="to"),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[BookingOut]:
    """As marcações do profissional, opcionalmente dentro de um intervalo.

    O intervalo serve o calendário, que carrega só o que está à vista. Apanha
    tudo o que *toca* a janela, e não só o que começa lá dentro: um atendimento
    que comece às 23h30 de domingo pertence à semana que acaba, mesmo que
    termine já na seguinte. O `from` é inclusivo e o `to` exclusivo.
    """
    # "Apenas as próximas" e apenas um caso particular de janela: daqui em diante.
    desde = inicio
    if upcoming:
        agora = datetime.now(timezone.utc)
        desde = max(desde, agora) if desde is not None else agora

    rows = bookings_in_window(
        db, professional.id, desde, fim, status=status_filter, limit=limit
    )
    return [BookingOut.model_validate(b) for b in rows]


@router.patch("/bookings/{booking_id}", response_model=BookingOut)
def update_booking_status(
    booking_id: int,
    payload: BookingStatusUpdate,
    professional: CurrentProfessional,
    db: DbSession,
) -> BookingOut:
    booking = db.get(Booking, booking_id)
    if not booking or booking.professional_id != professional.id:
        raise HTTPException(status_code=404, detail="Marcação não encontrada.")

    previous = booking.status
    booking.status = payload.status
    if payload.cancel_reason:
        booking.cancel_reason = payload.cancel_reason

    # Contador de atendimentos concluidos, mantido consistente nos dois sentidos.
    if payload.status == BookingStatus.COMPLETED and previous != BookingStatus.COMPLETED:
        professional.completed_bookings = (professional.completed_bookings or 0) + 1
    elif previous == BookingStatus.COMPLETED and payload.status != BookingStatus.COMPLETED:
        professional.completed_bookings = max((professional.completed_bookings or 0) - 1, 0)

    db.commit()
    db.refresh(booking)

    # Aviso da mudança de estado. Vai só para o cliente, mesmo que o gatilho
    # esteja marcado para avisar também o profissional: foi ele quem carregou
    # no botão e não faz sentido receber notícia do que acabou de fazer.
    gatilho = trigger_for_status(payload.status)
    if gatilho and payload.status != previous and payload.notify is not False:
        dispatch(db, booking, gatilho, professional=professional, only_client=True)

    return BookingOut.model_validate(booking)


@router.get("/bookings/{booking_id}/preview/{new_status}", response_model=StatusChangePreview)
def preview_status_change(
    booking_id: int,
    new_status: BookingStatus,
    professional: CurrentProfessional,
    db: DbSession,
) -> StatusChangePreview:
    """O que o cliente receberia se esta mudança fosse aplicada.

    O painel usa isto para perguntar antes de agir, mostrando o texto e o canal.
    """
    booking = db.get(Booking, booking_id)
    if not booking or booking.professional_id != professional.id:
        raise HTTPException(status_code=404, detail="Marcação não encontrada.")

    gatilho = trigger_for_status(new_status)
    if gatilho is None:
        return StatusChangePreview(status=new_status, will_notify=False)

    dados = preview(db, booking, professional, gatilho, only_client=True)
    db.commit()

    return StatusChangePreview(
        status=new_status,
        trigger=gatilho.value,
        trigger_label=TRIGGER_LABELS.get(gatilho),
        **dados,
    )


@router.get("/stats")
def my_stats(professional: CurrentProfessional, db: DbSession) -> dict:
    """Numeros do painel do profissional."""
    now = datetime.now(timezone.utc)
    month_ago = now - timedelta(days=30)

    by_status = dict(
        db.execute(
            select(Booking.status, func.count(Booking.id))
            .where(Booking.professional_id == professional.id)
            .group_by(Booking.status)
        ).all()
    )
    upcoming = db.scalar(
        select(func.count(Booking.id)).where(
            Booking.professional_id == professional.id,
            Booking.starts_at >= now,
            Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
        )
    )
    revenue = db.scalar(
        select(func.coalesce(func.sum(Booking.price_cents), 0)).where(
            Booking.professional_id == professional.id,
            Booking.status == BookingStatus.COMPLETED,
            Booking.starts_at >= month_ago,
        )
    )
    return {
        "upcoming_bookings": int(upcoming or 0),
        "pending_bookings": int(by_status.get(BookingStatus.PENDING, 0)),
        "completed_bookings": int(by_status.get(BookingStatus.COMPLETED, 0)),
        "cancelled_bookings": int(by_status.get(BookingStatus.CANCELLED, 0)),
        "revenue_30d_cents": int(revenue or 0),
        "rating_avg": professional.rating_avg,
        "rating_count": professional.rating_count,
        "profile_views": professional.profile_views,
        "status": professional.status.value,
    }


# ------------------------------------------------------------------ plano ---
@router.get("/subscription", response_model=SubscriptionOut | None)
def my_subscription(professional: CurrentProfessional, db: DbSession) -> SubscriptionOut | None:
    subscription = db.scalar(
        select(Subscription).where(Subscription.professional_id == professional.id)
    )
    return SubscriptionOut.model_validate(subscription) if subscription else None


@router.post("/subscription", response_model=SubscriptionOut)
def change_plan(
    payload: ChangePlanRequest, professional: CurrentProfessional, db: DbSession
) -> SubscriptionOut:
    """Troca de plano. O gateway de pagamento entra aqui em uma etapa futura."""
    plan = db.get(Plan, payload.plan_id)
    if not plan or not plan.is_active:
        raise HTTPException(status_code=404, detail="Plano não encontrado.")

    now = datetime.now(timezone.utc)
    period_days = 365 if plan.billing_interval == "yearly" else 30

    subscription = db.scalar(
        select(Subscription).where(Subscription.professional_id == professional.id)
    )
    if subscription:
        subscription.plan_id = plan.id
        subscription.status = SubscriptionStatus.ACTIVE
        subscription.current_period_start = now
        subscription.current_period_end = now + timedelta(days=period_days)
        subscription.cancelled_at = None
    else:
        subscription = Subscription(
            professional_id=professional.id,
            plan_id=plan.id,
            status=SubscriptionStatus.ACTIVE,
            current_period_start=now,
            current_period_end=now + timedelta(days=period_days),
        )
        db.add(subscription)

    # O destaque na vitrine e um beneficio do plano.
    professional.is_featured = plan.featured_listing

    db.commit()
    db.refresh(subscription)
    return SubscriptionOut.model_validate(subscription)


# --------------------------------------------------- agendamentos do cliente ---
@router.get("/appointments", response_model=list[BookingWithProfessional])
def my_appointments(user: CurrentUser, db: DbSession) -> list[BookingWithProfessional]:
    """Agendamentos feitos pelo usuario logado enquanto cliente."""
    rows = db.execute(
        select(Booking, Professional)
        .join(Professional, Professional.id == Booking.professional_id)
        .where(Booking.client_id == user.id)
        .order_by(Booking.starts_at.desc())
        .limit(100)
    ).all()

    result = []
    for booking, professional in rows:
        item = BookingWithProfessional.model_validate(booking)
        item.professional_slug = professional.slug
        item.professional_name = professional.display_name
        item.professional_avatar = professional.avatar_url
        result.append(item)
    return result


# ------------------------------------------------------ cadastro de clientes ---
def _client_or_404(db: DbSession, professional: Professional, client_id: int):
    client = db.get(ProfessionalClient, client_id)
    if not client or client.professional_id != professional.id:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    return client


def _with_summary(db: DbSession, clients: list) -> list[ClientOut]:
    summary = client_summary(db, [c.id for c in clients])
    result = []
    for client in clients:
        item = ClientOut.model_validate(client)
        stats = summary.get(client.id)
        if stats:
            item.bookings_count = stats["bookings_count"]
            item.last_visit_at = stats["last_visit_at"]
        result.append(item)
    return result


@router.get("/clients", response_model=Page[ClientOut])
def list_clients(
    professional: CurrentProfessional,
    db: DbSession,
    q: str | None = Query(default=None, description="Nome, telefone ou e-mail"),
    include_inactive: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
) -> Page[ClientOut]:
    query = select(ProfessionalClient).where(
        ProfessionalClient.professional_id == professional.id
    )
    if not include_inactive:
        query = query.where(ProfessionalClient.is_active.is_(True))

    if q and q.strip():
        term = "%" + q.strip().lower() + "%"
        digits = phone_digits(q)
        conditions = [
            func.lower(ProfessionalClient.name).like(term),
            func.lower(func.coalesce(ProfessionalClient.email, "")).like(term),
        ]
        if digits:
            conditions.append(ProfessionalClient.phone_digits.like("%" + digits + "%"))
        query = query.where(or_(*conditions))

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = list(
        db.scalars(
            query.order_by(ProfessionalClient.name)
            .offset((page - 1) * per_page)
            .limit(per_page)
        ).all()
    )

    return Page[ClientOut](
        items=_with_summary(db, rows),
        total=total,
        page=page,
        per_page=per_page,
        pages=max((total + per_page - 1) // per_page, 1),
    )


@router.post("/clients", response_model=ClientOut, status_code=status.HTTP_201_CREATED)
def create_client(
    payload: ClientUpsert, professional: CurrentProfessional, db: DbSession
) -> ClientOut:
    data = payload.model_dump()
    client = ProfessionalClient(
        professional_id=professional.id,
        phone_digits=phone_digits(data.get("phone")),
        **data,
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return ClientOut.model_validate(client)


@router.get("/clients/{client_id}", response_model=ClientDetail)
def client_detail(
    client_id: int, professional: CurrentProfessional, db: DbSession
) -> ClientDetail:
    client = _client_or_404(db, professional, client_id)

    bookings = db.scalars(
        select(Booking)
        .where(Booking.professional_client_id == client.id)
        .order_by(Booking.starts_at.desc())
        .limit(50)
    ).all()

    detail = ClientDetail.model_validate(client)
    detail.bookings = [BookingOut.model_validate(b) for b in bookings]
    detail.bookings_count = len(bookings)
    detail.last_visit_at = bookings[0].starts_at if bookings else None
    return detail


@router.put("/clients/{client_id}", response_model=ClientOut)
def update_client(
    client_id: int, payload: ClientUpsert, professional: CurrentProfessional, db: DbSession
) -> ClientOut:
    client = _client_or_404(db, professional, client_id)

    for field, value in payload.model_dump().items():
        setattr(client, field, value)
    client.phone_digits = phone_digits(client.phone)

    db.commit()
    db.refresh(client)
    return ClientOut.model_validate(client)


@router.delete("/clients/{client_id}", response_model=Message)
def delete_client(
    client_id: int, professional: CurrentProfessional, db: DbSession
) -> Message:
    client = _client_or_404(db, professional, client_id)

    # Ficha com historico e arquivada, para nao apagar o passado dos atendimentos.
    has_history = db.scalar(
        select(Booking.id).where(Booking.professional_client_id == client.id)
    )
    if has_history:
        client.is_active = False
        db.commit()
        return Message(detail="Cliente arquivado: tem atendimentos no histórico.")

    db.delete(client)
    db.commit()
    return Message(detail="Cliente removido.")


# --------------------------------------------- agendamento feito pelo painel ---
@router.post("/bookings", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_internal_booking(
    payload: InternalBookingCreate, professional: CurrentProfessional, db: DbSession
) -> BookingOut:
    """Lancamento manual do profissional.

    Ao contrario da agenda publica, aqui nao valem a grade de atendimento, os
    bloqueios nem a antecedencia minima: quem esta lancando e o dono da agenda
    e pode registrar um encaixe, um horario extra ou um atendimento passado.
    A unica trava e nao ocupar o mesmo horario duas vezes.
    """
    # --- servico: do catalogo ou avulso ---
    if payload.service_id is not None:
        service = db.get(Service, payload.service_id)
        if not service or service.professional_id != professional.id:
            raise HTTPException(status_code=404, detail="Serviço não encontrado.")
        service_id = service.id
        service_name = service.name
        duration = payload.duration_min or service.duration_min
        price = payload.price_cents if payload.price_cents is not None else service.price_cents
    else:
        service_id = None
        service_name = payload.service_name.strip()
        duration = payload.duration_min
        price = payload.price_cents or 0

    starts_at = payload.starts_at
    if starts_at.tzinfo is None:
        starts_at = starts_at.replace(tzinfo=timezone.utc)
    starts_at = starts_at.astimezone(timezone.utc)
    ends_at = starts_at + timedelta(minutes=duration)

    # --- unica regra de agenda que vale aqui ---
    if has_booking_conflict(db, professional, starts_at, ends_at):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe uma marcação nesta hora.",
        )

    # --- cliente: ficha existente ou nova ---
    client = None
    if payload.client_id is not None:
        client = _client_or_404(db, professional, payload.client_id)
    elif payload.save_client:
        client = find_or_create_client(
            db,
            professional.id,
            name=payload.client_name,
            phone=payload.client_phone,
            email=payload.client_email,
        )

    booking = Booking(
        code=new_booking_code(db),
        professional_id=professional.id,
        service_id=service_id,
        professional_client_id=client.id if client else None,
        client_id=client.user_id if client else None,
        client_name=(client.name if client else payload.client_name.strip()),
        client_phone=(
            (client.phone if client else payload.client_phone) or "nao informado"
        ),
        client_email=(client.email if client else payload.client_email),
        starts_at=starts_at,
        ends_at=ends_at,
        status=payload.status,
        service_name=service_name,
        price_cents=price,
        at_home=payload.at_home,
        address_line=payload.address_line,
        notes=payload.notes,
        created_by_professional=True,
    )
    db.add(booking)

    if payload.status == BookingStatus.COMPLETED:
        professional.completed_bookings = (professional.completed_bookings or 0) + 1

    db.commit()
    db.refresh(booking)
    return BookingOut.model_validate(booking)


# ---------------------------------------------------------------- financeiro --


@router.get("/finance", response_model=FinanceSummaryOut)
def finance_summary(
    professional: CurrentProfessional,
    db: DbSession,
    ano: int = Query(default=0, ge=0, le=2100),
    mes: int = Query(default=0, ge=0, le=12),
) -> FinanceSummaryOut:
    """As contas de um mês: feito, previsto, comissão devida e despesas.

    Sem ano nem mês responde sobre o mês corrente do profissional — que é o do
    fuso horário dele, e não o do servidor.
    """
    return _contas(db, professional, ano, mes)


def _contas(
    db: DbSession, professional: Professional, ano: int = 0, mes: int = 0
) -> FinanceSummaryOut:
    """O resumo já em forma de resposta.

    Vive à parte porque dois endpoints precisam dele, e chamar um endpoint como
    função normal entregaria-lhe os objectos `Query` das assinaturas em vez dos
    valores — um 500 que ninguém vê, porque a gravação já aconteceu antes.
    """
    hoje = datetime.now(ZoneInfo(professional.timezone or "Europe/Lisbon")).date()
    resumo = resumo_do_mes(db, professional, ano or hoje.year, mes or hoje.month)

    return FinanceSummaryOut(
        ano=resumo.ano,
        mes=resumo.mes,
        commission_percent=resumo.commission_percent,
        feito=LinhaOut(
            quantidade=resumo.feito.quantidade,
            bruto_cents=resumo.feito.bruto_cents,
            comissao_cents=resumo.feito.comissao_cents,
            liquido_cents=resumo.feito.liquido_cents,
        ),
        previsto=LinhaOut(
            quantidade=resumo.previsto.quantidade,
            bruto_cents=resumo.previsto.bruto_cents,
            comissao_cents=resumo.previsto.comissao_cents,
            liquido_cents=resumo.previsto.liquido_cents,
        ),
        perdido_cents=resumo.perdido_cents,
        perdido_quantidade=resumo.perdido_quantidade,
        despesas_cents=resumo.despesas_cents,
        despesas_por_categoria=resumo.despesas_por_categoria,
        bruto_total_cents=resumo.bruto_total_cents,
        comissao_total_cents=resumo.comissao_total_cents,
        resultado_cents=resumo.resultado_cents,
        resultado_projetado_cents=resumo.resultado_projetado_cents,
        dias=[
            DiaOut(dia=d.dia, feito_cents=d.feito_cents, previsto_cents=d.previsto_cents)
            for d in resumo.dias
        ],
        categorias=EXPENSE_CATEGORIES,
    )


@router.put("/finance/commission", response_model=FinanceSummaryOut)
def set_commission(
    payload: CommissionIn,
    professional: CurrentProfessional,
    db: DbSession,
) -> FinanceSummaryOut:
    professional.commission_percent = payload.commission_percent
    db.commit()
    return _contas(db, professional)


@router.get("/expenses", response_model=list[ExpenseOut])
def list_expenses(
    professional: CurrentProfessional,
    db: DbSession,
    ano: int = Query(default=0, ge=0, le=2100),
    mes: int = Query(default=0, ge=0, le=12),
) -> list[ExpenseOut]:
    """As despesas que pesam num mês, recorrentes incluídas."""
    hoje = datetime.now(ZoneInfo(professional.timezone or "Europe/Lisbon")).date()
    inicio, fim = month_bounds(ano or hoje.year, mes or hoje.month, professional.timezone)
    rows = despesas_do_mes(
        db, professional.id, inicio.date(), (fim - timedelta(days=1)).date()
    )
    rows.sort(key=lambda e: (e.incurred_on, e.id), reverse=True)
    return [ExpenseOut.model_validate(e) for e in rows]


@router.post("/expenses", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(
    payload: ExpenseIn, professional: CurrentProfessional, db: DbSession
) -> ExpenseOut:
    if payload.ends_on and payload.ends_on < payload.incurred_on:
        raise HTTPException(status_code=400, detail="O fim não pode ser antes do início.")
    if payload.category not in EXPENSE_CATEGORIES:
        raise HTTPException(status_code=400, detail="Categoria desconhecida.")

    despesa = Expense(
        professional_id=professional.id,
        description=payload.description.strip(),
        amount_cents=payload.amount_cents,
        incurred_on=payload.incurred_on,
        category=payload.category,
        recurring=payload.recurring,
        ends_on=payload.ends_on if payload.recurring else None,
        notes=payload.notes,
    )
    db.add(despesa)
    db.commit()
    db.refresh(despesa)
    return ExpenseOut.model_validate(despesa)


@router.delete("/expenses/{expense_id}", response_model=Message)
def delete_expense(expense_id: int, professional: CurrentProfessional, db: DbSession) -> Message:
    despesa = db.get(Expense, expense_id)
    if not despesa or despesa.professional_id != professional.id:
        raise HTTPException(status_code=404, detail="Despesa não encontrada.")
    db.delete(despesa)
    db.commit()
    return Message(detail="Despesa removida.")
