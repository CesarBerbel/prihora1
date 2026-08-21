"""Popula o banco de forma idempotente: rodar de novo nao duplica nada."""

import logging
import random
from datetime import datetime, time, timedelta, timezone

from slugify import slugify
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models import (
    Availability,
    Booking,
    BookingStatus,
    Category,
    City,
    Plan,
    Professional,
    ProfessionalStatus,
    Review,
    Service,
    Subscription,
    User,
    UserRole,
)
from app.models.enums import SubscriptionStatus
from app.seed.data import CATEGORIES, CITIES, DEMO_PROFESSIONALS, PLANS
from app.services.clients import find_or_create_client

logger = logging.getLogger("prihora.seed")

# Semente fixa: o conjunto de demonstracao sai igual em toda maquina.
rng = random.Random(20240101)

REVIEW_COMMENTS = [
    "Atendimento impecavel, super pontual. Recomendo demais!",
    "Ambiente limpo e organizado, sai amando o resultado.",
    "Profissional atenciosa e caprichosa. Ja marquei o proximo.",
    "Otimo custo-beneficio, ficou exatamente como eu queria.",
    "Muito cuidadosa com a higiene, me senti segura o tempo todo.",
    "Trabalho caprichado e resultado natural. Voltarei sim!",
    "Explicou cada etapa do procedimento, adorei a experiencia.",
    "Chegou no horario e o resultado superou a expectativa.",
]

CLIENT_NAMES = [
    "Beatriz Almeida", "Carolina Rocha", "Catarina Prado", "Inês Lima",
    "Joana Nunes", "Leonor Castro", "Margarida Freitas", "Mariana Gomes",
    "Matilde Teixeira", "Rita Ribeiro", "Sofia Andrade", "Teresa Vieira",
]


def telemovel(rng) -> str:
    """Um telemóvel português plausível: 9 dígitos, começado em 91/92/93/96."""
    return (
        f"9{rng.choice('1236')}{rng.randint(0, 9)} "
        f"{rng.randint(100, 999)} {rng.randint(100, 999)}"
    )


def seed_categories(db: Session) -> dict[str, Category]:
    """Sincroniza o catálogo de especialidades.

    Dados de referência são do seed, não do utilizador: por isso atualizamos os
    que já existem em vez de os ignorar. Sem isto, corrigir um nome ou uma
    descrição nunca chegaria a quem já tinha a base criada.
    """
    existing = {c.slug: c for c in db.scalars(select(Category)).all()}
    for slug, name, description, icon, order in CATEGORIES:
        category = existing.get(slug)
        if category is None:
            category = Category(slug=slug)
            db.add(category)
            existing[slug] = category
        category.name = name
        category.description = description
        category.icon = icon
        category.sort_order = order
        category.is_active = True
    db.flush()
    return existing


def seed_cities(db: Session) -> None:
    """Sincroniza a lista de localidades, removendo as que já não pertencem.

    A tabela é puramente de referência e ninguém aponta para ela, por isso pode
    ser espelhada. É o que tira do ar localidades de um país anterior.
    """
    existing = {c.slug: c for c in db.scalars(select(City)).all()}
    desejadas: set[str] = set()

    for name, state, lat, lng, population in CITIES:
        slug = slugify(f"{name}-{state}")
        desejadas.add(slug)
        city = existing.get(slug)
        if city is None:
            city = City(slug=slug)
            db.add(city)
        city.name = name
        city.state = state
        city.latitude = lat
        city.longitude = lng
        city.population = population

    obsoletas = [c for slug, c in existing.items() if slug not in desejadas]
    for city in obsoletas:
        db.delete(city)
    if obsoletas:
        logger.info("Removidas %s localidades fora da lista atual.", len(obsoletas))

    db.flush()


def seed_plans(db: Session) -> dict[str, Plan]:
    """Sincroniza os planos que o seed conhece.

    Planos criados pelo sector administrativo não são tocados; só os quatro
    de origem. Atualizá-los importa porque preço e descrição mudam — na
    passagem para o euro, por exemplo, os valores tinham de ser convertidos.
    """
    existing = {p.slug: p for p in db.scalars(select(Plan)).all()}
    for row in PLANS:
        (slug, name, description, price, services, photos, bookings, featured,
         agenda, analytics, support, trial, active, default, order) = row

        plan = existing.get(slug)
        if plan is None:
            plan = Plan(slug=slug)
            db.add(plan)
            existing[slug] = plan

        plan.name = name
        plan.description = description
        plan.price_cents = price
        plan.billing_interval = "monthly"
        plan.max_services = services
        plan.max_photos = photos
        plan.max_bookings_per_month = bookings
        plan.featured_listing = featured
        plan.online_agenda = agenda
        plan.analytics = analytics
        plan.priority_support = support
        plan.trial_days = trial
        plan.is_active = active
        plan.is_default = default
        plan.sort_order = order

    db.flush()
    return existing


def seed_admin(db: Session) -> User:
    email = settings.ADMIN_EMAIL.lower().strip()
    admin = db.scalar(select(User).where(User.email == email))
    if admin:
        # Garante o papel mesmo se a conta ja existia com outro perfil.
        if admin.role != UserRole.ADMIN:
            admin.role = UserRole.ADMIN
            db.flush()
        return admin

    admin = User(
        name=settings.ADMIN_NAME,
        email=email,
        password_hash=hash_password(settings.ADMIN_PASSWORD),
        role=UserRole.ADMIN,
    )
    db.add(admin)
    db.flush()
    logger.info("Administrador criado: %s", email)
    return admin


def _weekly_grid(professional_id: int, weekend: bool = False) -> list[Availability]:
    """Grade padrao: seg-sex 09:00-18:00 e, opcionalmente, sabado 09:00-14:00."""
    grid = [
        Availability(
            professional_id=professional_id,
            weekday=weekday,
            start_time=time(9, 0),
            end_time=time(18, 0),
        )
        for weekday in range(0, 5)
    ]
    if weekend:
        grid.append(
            Availability(
                professional_id=professional_id,
                weekday=5,
                start_time=time(9, 0),
                end_time=time(14, 0),
            )
        )
    return grid


def seed_demo(db: Session, categories: dict[str, Category], plans: dict[str, Plan]) -> None:
    """Cria profissionais, servicos, agendas, agendamentos e avaliacoes de exemplo."""
    now = datetime.now(timezone.utc)

    # Cliente de demonstracao, usado como autor dos agendamentos.
    client = db.scalar(select(User).where(User.email == "cliente@prihora.pt"))
    if not client:
        client = User(
            name="Cliente Demo",
            email="cliente@prihora.pt",
            password_hash=hash_password("demo123"),
            phone="912 000 000",
            role=UserRole.CLIENT,
        )
        db.add(client)
        db.flush()

    for index, spec in enumerate(DEMO_PROFESSIONALS):
        email = spec["email"]
        if db.scalar(select(User.id).where(User.email == email)):
            continue

        user = User(
            name=spec["name"],
            email=email,
            password_hash=hash_password("demo123"),
            phone=spec["phone"],
            role=UserRole.PROFESSIONAL,
        )
        db.add(user)
        db.flush()

        pending = spec.get("pending", False)
        professional = Professional(
            user_id=user.id,
            slug=slugify(spec["display_name"]),
            display_name=spec["display_name"],
            headline=spec["headline"],
            bio=spec["bio"],
            public_phone=spec["phone"],
            whatsapp=spec["phone"],
            instagram=spec.get("instagram"),
            address_line=spec.get("address_line"),
            neighborhood=spec.get("neighborhood"),
            postal_code=spec.get("postal_code"),
            city=spec["city"],
            state=spec["state"],
            latitude=spec["lat"],
            longitude=spec["lng"],
            serves_at_studio=not spec.get("home_only", False),
            serves_at_home=spec.get("at_home", False),
            home_service_radius_km=15 if spec.get("at_home") else 10,
            status=ProfessionalStatus.PENDING if pending else ProfessionalStatus.ACTIVE,
            is_verified=spec.get("verified", False),
            is_featured=spec.get("featured", False),
            rating_avg=spec.get("rating", 0.0),
            rating_count=spec.get("reviews", 0),
            completed_bookings=spec.get("reviews", 0),
            profile_views=rng.randint(40, 900),
            timezone=settings.DEFAULT_TIMEZONE,
            auto_confirm=index % 3 == 0,
            slot_interval_min=30,
        )
        professional.categories = [
            categories[slug] for slug in spec["categories"] if slug in categories
        ]
        db.add(professional)
        db.flush()

        for order, (name, duration, price) in enumerate(spec["services"], start=1):
            db.add(
                Service(
                    professional_id=professional.id,
                    category_id=(
                        categories[spec["categories"][0]].id if spec["categories"] else None
                    ),
                    name=name,
                    description=f"{name}, com {duration} minutos de duração.",
                    duration_min=duration,
                    price_cents=price,
                    sort_order=order * 10,
                )
            )

        for slot in _weekly_grid(professional.id, weekend=index % 2 == 0):
            db.add(slot)

        plan = plans.get(spec.get("plan", "gratuito"))
        if plan:
            db.add(
                Subscription(
                    professional_id=professional.id,
                    plan_id=plan.id,
                    status=SubscriptionStatus.ACTIVE,
                    current_period_start=now - timedelta(days=rng.randint(1, 25)),
                    current_period_end=now + timedelta(days=rng.randint(5, 29)),
                )
            )

        db.flush()

        if not pending:
            _seed_bookings_and_reviews(db, professional, client, now)

    db.flush()


def _seed_bookings_and_reviews(
    db: Session, professional: Professional, client: User, now: datetime
) -> None:
    """Gera historico passado (concluido, com avaliacao) e agenda futura."""
    services = db.scalars(
        select(Service).where(Service.professional_id == professional.id)
    ).all()
    if not services:
        return

    code_seq = 0

    def next_code() -> str:
        nonlocal code_seq
        code_seq += 1
        return f"PH{professional.id:03d}{code_seq:03d}"

    def ficha(nome: str, telefone: str, email: str | None, user_id: int | None):
        """Mesma rotina da agenda publica: a lista de clientes se forma sozinha."""
        return find_or_create_client(
            db,
            professional.id,
            name=nome,
            phone=telefone,
            email=email,
            user_id=user_id,
            from_booking=True,
        )

    # --- historico concluido ---
    ratings = []
    for i in range(rng.randint(3, 6)):
        service = rng.choice(services)
        start = (now - timedelta(days=rng.randint(3, 60))).replace(
            hour=rng.randint(9, 16), minute=rng.choice([0, 30]), second=0, microsecond=0
        )
        nome = rng.choice(CLIENT_NAMES)
        telefone = telemovel(rng)
        email = "cliente@prihora.pt" if i % 2 == 0 else None
        registro = ficha(nome, telefone, email, client.id if i % 2 == 0 else None)

        booking = Booking(
            code=next_code(),
            professional_id=professional.id,
            service_id=service.id,
            professional_client_id=registro.id,
            client_id=client.id if i % 2 == 0 else None,
            client_name=nome,
            client_phone=telefone,
            client_email=email,
            starts_at=start,
            ends_at=start + timedelta(minutes=service.duration_min),
            status=BookingStatus.COMPLETED,
            service_name=service.name,
            price_cents=service.price_cents,
        )
        db.add(booking)
        db.flush()

        if rng.random() < 0.75:
            rating = rng.choice([5, 5, 5, 4, 4, 5])
            ratings.append(rating)
            db.add(
                Review(
                    professional_id=professional.id,
                    booking_id=booking.id,
                    author_id=booking.client_id,
                    author_name=booking.client_name,
                    rating=rating,
                    comment=rng.choice(REVIEW_COMMENTS),
                    created_at=booking.ends_at + timedelta(hours=rng.randint(2, 48)),
                )
            )

    # --- agenda futura, em horarios validos da grade ---
    slots_used: set[datetime] = set()
    for i in range(rng.randint(2, 5)):
        service = rng.choice(services)
        days_ahead = rng.randint(1, 12)
        target = now + timedelta(days=days_ahead)
        # A grade demo cobre segunda a sabado; domingo vira segunda.
        while target.weekday() == 6:
            target += timedelta(days=1)
        start = target.replace(
            hour=rng.randint(10, 15), minute=rng.choice([0, 30]), second=0, microsecond=0
        )
        if start in slots_used:
            continue
        slots_used.add(start)

        nome = rng.choice(CLIENT_NAMES)
        telefone = telemovel(rng)
        email = "cliente@prihora.pt" if i == 0 else None
        registro = ficha(nome, telefone, email, client.id if i == 0 else None)

        db.add(
            Booking(
                code=next_code(),
                professional_id=professional.id,
                service_id=service.id,
                professional_client_id=registro.id,
                client_id=client.id if i == 0 else None,
                client_name=nome,
                client_phone=telefone,
                client_email=email,
                starts_at=start,
                ends_at=start + timedelta(minutes=service.duration_min),
                status=BookingStatus.CONFIRMED if i % 2 == 0 else BookingStatus.PENDING,
                service_name=service.name,
                price_cents=service.price_cents,
                notes="Agendamento de demonstracao." if i == 0 else None,
            )
        )

    # A media exibida passa a refletir as avaliacoes realmente gravadas.
    if ratings:
        professional.rating_avg = round(sum(ratings) / len(ratings), 2)
        professional.rating_count = len(ratings)


def run_seed(db: Session) -> None:
    categories = seed_categories(db)
    seed_cities(db)
    plans = seed_plans(db)
    seed_admin(db)

    if settings.SEED_DEMO_DATA:
        seed_demo(db, categories, plans)

    db.commit()
    logger.info("Seed concluido.")
