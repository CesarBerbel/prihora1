"""Busca publica de profissionais: texto + categoria + localidade + proximidade.

Quando a localidade informada nao tem ninguem dentro do raio, a busca nao
devolve vazio: ela repete a consulta sem o recorte geografico e ordena por
distancia, marcando o resultado como ampliado para a interface poder avisar.
"""

from dataclasses import dataclass, field

from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    Category,
    City,
    Professional,
    ProfessionalStatus,
    Service,
    professional_categories,
)
from app.services.geo import bounding_box, haversine_km

DEFAULT_RADIUS_KM = 25.0
MAX_RADIUS_KM = 300.0
FAR_AWAY = 1e9
EXPENSIVE = 10 ** 9


# Camadas do resultado, na ordem em que aparecem.
GROUP_REGION = "region"
GROUP_ELSEWHERE = "elsewhere"
GROUP_FEATURED = "featured"


@dataclass
class SearchHit:
    professional: Professional
    distance_km: float | None = None
    price_from_cents: int | None = None
    # Camada a que o resultado pertence.
    group: str = GROUP_REGION


@dataclass
class SearchOutcome:
    items: list[SearchHit] = field(default_factory=list)
    total: int = 0
    matched_city: City | None = None
    # Distancia do resultado mais proximo, para a mensagem da interface.
    nearest_km: float | None = None
    # Quantos ha em cada camada, para os cabecalhos de seccao.
    region_total: int = 0
    elsewhere_total: int = 0
    featured_total: int = 0

    @property
    def expanded(self) -> bool:
        """Nao havia ninguem na regiao pedida, mas ha resultados mais longe."""
        return self.region_total == 0 and self.total > 0


def resolve_location(
    db: Session,
    *,
    lat: float | None,
    lng: float | None,
    city: str | None,
    state: str | None,
) -> tuple[float | None, float | None, City | None]:
    """Descobre o ponto de referencia da busca.

    Coordenadas explicitas (geolocalizacao do navegador) tem prioridade;
    caso contrario tentamos casar o texto digitado com uma cidade conhecida.
    """
    if lat is not None and lng is not None:
        return lat, lng, None

    term = (city or "").strip()
    if not term:
        return None, None, None

    # Aceita "Braga, Braga", "Vila Nova de Gaia - Porto" ou "Almada/Setúbal".
    # O sufixo é o nome do distrito, então não dá para exigir duas letras:
    # só separamos quando o que sobra à esquerda continua sendo uma cidade.
    if not state:
        for sep in (",", "/"):
            if sep in term:
                head, _, tail = term.rpartition(sep)
                if head.strip() and tail.strip():
                    term, state = head.strip(), tail.strip()
                    break

    query = select(City).where(func.lower(City.name) == term.lower())
    if state:
        query = query.where(func.lower(City.state) == state.lower())
    match = db.scalars(query.order_by(City.population.desc()).limit(1)).first()

    if not match:
        query = select(City).where(func.lower(City.name).like(term.lower() + "%"))
        if state:
            query = query.where(func.lower(City.state) == state.lower())
        match = db.scalars(query.order_by(City.population.desc()).limit(1)).first()

    if match:
        return match.latitude, match.longitude, match
    return None, None, None


def _base_query() -> Select:
    return (
        select(Professional)
        .options(selectinload(Professional.categories))
        .where(Professional.status == ProfessionalStatus.ACTIVE)
    )


def _apply_filters(
    query: Select,
    *,
    q: str | None,
    category: str | None,
    at_home: bool | None,
    max_price_cents: int | None,
    featured: bool | None = None,
) -> Select:
    """Filtros que nao dependem de localizacao.

    Sao os unicos preservados quando a busca precisa ser ampliada: quem procura
    por tatuagem continua vendo so tatuadores, mesmo fora do raio pedido.
    """
    if q and q.strip():
        term = "%" + q.strip().lower() + "%"
        service_match = (
            select(Service.professional_id)
            .where(and_(Service.is_active.is_(True), func.lower(Service.name).like(term)))
            .scalar_subquery()
        )
        category_match = (
            select(professional_categories.c.professional_id)
            .join(Category, Category.id == professional_categories.c.category_id)
            .where(func.lower(Category.name).like(term))
            .scalar_subquery()
        )
        query = query.where(
            or_(
                func.lower(Professional.display_name).like(term),
                func.lower(func.coalesce(Professional.headline, "")).like(term),
                func.lower(func.coalesce(Professional.bio, "")).like(term),
                Professional.id.in_(service_match),
                Professional.id.in_(category_match),
            )
        )

    if category:
        cat_sub = (
            select(professional_categories.c.professional_id)
            .join(Category, Category.id == professional_categories.c.category_id)
            .where(Category.slug == category)
            .scalar_subquery()
        )
        query = query.where(Professional.id.in_(cat_sub))

    if at_home:
        query = query.where(Professional.serves_at_home.is_(True))

    if featured:
        # Pedir os destaques deixa de os empurrar para a última camada: passam
        # a ser o conjunto todo, e as camadas voltam a ordená-los por região.
        query = query.where(Professional.is_featured.is_(True))

    if max_price_cents is not None:
        price_sub = (
            select(Service.professional_id)
            .where(and_(Service.is_active.is_(True), Service.price_cents <= max_price_cents))
            .scalar_subquery()
        )
        query = query.where(Professional.id.in_(price_sub))

    return query


def _prices_by_professional(db: Session, rows: list[Professional]) -> dict[int, int]:
    """Menor preco de cada profissional, em um unico round-trip."""
    if not rows:
        return {}
    ids = [p.id for p in rows]
    return dict(
        db.execute(
            select(Service.professional_id, func.min(Service.price_cents))
            .where(Service.professional_id.in_(ids), Service.is_active.is_(True))
            .group_by(Service.professional_id)
        ).all()
    )


def _to_hits(
    db: Session,
    rows: list[Professional],
    *,
    ref_lat: float | None,
    ref_lng: float | None,
    radius_km: float | None,
) -> list[SearchHit]:
    """Calcula distancia e preco. Com radius_km, descarta quem ficou fora.

    O pre-filtro por caixa envolvente e generoso de proposito: a caixa e
    quadrada e o raio, redondo. Este passo aplica a distancia real.
    """
    prices = _prices_by_professional(db, rows)
    hits: list[SearchHit] = []

    for pro in rows:
        distance = None
        if ref_lat is not None and pro.latitude is not None and pro.longitude is not None:
            distance = haversine_km(ref_lat, ref_lng, pro.latitude, pro.longitude)

            if radius_km is not None:
                # Quem atende em domicilio alcanca mais longe que o proprio estudio.
                reach = radius_km
                if pro.serves_at_home:
                    reach = max(reach, float(pro.home_service_radius_km or 0))
                if distance > reach:
                    continue

        hits.append(SearchHit(pro, distance, prices.get(pro.id)))

    return hits


def _sort_hits(hits: list[SearchHit], sort: str, has_distance: bool) -> None:
    """Ordena no lugar."""
    if sort == "distance" and has_distance:
        hits.sort(key=lambda h: h.distance_km if h.distance_km is not None else FAR_AWAY)
    elif sort == "rating":
        hits.sort(key=lambda h: (-h.professional.rating_avg, -h.professional.rating_count))
    elif sort == "price":
        hits.sort(key=lambda h: h.price_from_cents if h.price_from_cents is not None else EXPENSIVE)
    elif sort == "newest":
        hits.sort(key=lambda h: h.professional.created_at, reverse=True)
    else:
        # Relevancia: destaque, depois proximidade, depois reputacao.
        hits.sort(
            key=lambda h: (
                0 if h.professional.is_featured else 1,
                round(h.distance_km, 1) if h.distance_km is not None else FAR_AWAY,
                -h.professional.rating_avg,
                -h.professional.rating_count,
            )
        )


def _in_region(
    hit: SearchHit,
    *,
    radius_km: float,
    has_coords: bool,
    city_term: str,
    state: str | None,
) -> bool:
    """O profissional atende a localidade pedida?

    Com coordenadas, é o raio — alargado para quem se desloca ao domicílio,
    porque o alcance dele é maior que o do próprio espaço. Sem coordenadas,
    resta comparar o nome da localidade.
    """
    pro = hit.professional

    if has_coords:
        if hit.distance_km is None:
            return False
        alcance = radius_km
        if pro.serves_at_home:
            alcance = max(alcance, float(pro.home_service_radius_km or 0))
        return hit.distance_km <= alcance

    if not city_term:
        return True

    if (pro.city or "").strip().lower() != city_term.lower():
        return False
    if state and (pro.state or "").strip().lower() != state.lower():
        return False
    return True


def _por_distancia(hit: SearchHit) -> tuple[float, float, int]:
    """Mais perto primeiro; sem coordenadas vai para o fim, melhor avaliado à frente."""
    return (
        hit.distance_km if hit.distance_km is not None else FAR_AWAY,
        -hit.professional.rating_avg,
        -hit.professional.rating_count,
    )


def search_professionals(
    db: Session,
    *,
    q: str | None = None,
    category: str | None = None,
    city: str | None = None,
    state: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float | None = None,
    at_home: bool | None = None,
    max_price_cents: int | None = None,
    featured: bool | None = None,
    sort: str = "relevance",
    page: int = 1,
    per_page: int = 12,
) -> SearchOutcome:
    """Pesquisa em três camadas, sempre na mesma ordem.

    1. quem atende a localidade pedida;
    2. os restantes, do mais perto para o mais longe;
    3. os destaques que ficaram de fora, também por proximidade.

    A localidade deixou de cortar o resultado: passou a ordená-lo. Quem procura
    em Braga vê primeiro Braga, mas continua a ver o Porto logo a seguir em vez
    de uma página vazia. Os filtros de serviço valem em todas as camadas — só a
    geografia é que deixa de excluir.
    """
    ref_lat, ref_lng, matched_city = resolve_location(
        db, lat=lat, lng=lng, city=city, state=state
    )
    radius = min(radius_km or DEFAULT_RADIUS_KM, MAX_RADIUS_KM)
    city_term = (city or "").strip()
    has_coords = ref_lat is not None and ref_lng is not None

    filtered = _apply_filters(
        _base_query(),
        q=q,
        category=category,
        at_home=at_home,
        max_price_cents=max_price_cents,
        featured=featured,
    )

    # Uma consulta só: as camadas são um arranjo do mesmo conjunto.
    rows = list(db.scalars(filtered).unique().all())
    hits = _to_hits(db, rows, ref_lat=ref_lat, ref_lng=ref_lng, radius_km=None)

    pediu_localidade = has_coords or bool(city_term)

    regiao: list[SearchHit] = []
    outras: list[SearchHit] = []
    destaques: list[SearchHit] = []

    for hit in hits:
        if pediu_localidade and not _in_region(
            hit, radius_km=radius, has_coords=has_coords, city_term=city_term, state=state
        ):
            # Fora da região: o destaque vai para a última camada, como pedido.
            if hit.professional.is_featured:
                hit.group = GROUP_FEATURED
                destaques.append(hit)
            else:
                hit.group = GROUP_ELSEWHERE
                outras.append(hit)
        else:
            hit.group = GROUP_REGION
            regiao.append(hit)

    _sort_hits(regiao, sort, has_coords)
    outras.sort(key=_por_distancia)
    destaques.sort(key=_por_distancia)

    ordenados = regiao + outras + destaques
    nearest = next((h.distance_km for h in ordenados if h.distance_km is not None), None)

    start = max(page - 1, 0) * per_page
    return SearchOutcome(
        items=ordenados[start : start + per_page],
        total=len(ordenados),
        matched_city=matched_city,
        nearest_km=nearest,
        region_total=len(regiao),
        elsewhere_total=len(outras),
        featured_total=len(destaques),
    )
