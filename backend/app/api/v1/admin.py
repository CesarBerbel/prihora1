"""Setor administrativo: contas, profissionais, planos e metricas."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query, status
from slugify import slugify
from sqlalchemy import Date, cast, func, select
from sqlalchemy.orm import selectinload

from app.api.deps import AdminUser, DbSession
from app.models import (
    AuditLog,
    Booking,
    BookingStatus,
    Category,
    Plan,
    Professional,
    ProfessionalStatus,
    Service,
    Subscription,
    User,
    UserRole,
    professional_categories,
)
from app.models.enums import SubscriptionStatus
from app.schemas.admin import (
    AdminProfessionalOut,
    AdminProfessionalUpdate,
    AdminStats,
    AdminUserOut,
    AdminUserUpdate,
    AuditLogOut,
)
from app.schemas.catalog import PlanOut, PlanUpsert
from app.schemas.common import Message, Page
from app.schemas.booking import BookingOut

router = APIRouter(prefix="/admin", tags=["admin"])


def _log(db: DbSession, actor: User, action: str, entity: str, entity_id, detail: str = "") -> None:
    db.add(
        AuditLog(
            actor_id=actor.id,
            actor_email=actor.email,
            action=action,
            entity=entity,
            entity_id=str(entity_id),
            detail=detail or None,
        )
    )


# --------------------------------------------------------------- metricas ---
@router.get("/stats", response_model=AdminStats)
def stats(admin: AdminUser, db: DbSession) -> AdminStats:
    now = datetime.now(timezone.utc)
    month_ago = now - timedelta(days=30)

    users_by_role = dict(
        db.execute(select(User.role, func.count(User.id)).group_by(User.role)).all()
    )
    pros_by_status = dict(
        db.execute(
            select(Professional.status, func.count(Professional.id)).group_by(Professional.status)
        ).all()
    )
    bookings_by_status = dict(
        db.execute(
            select(Booking.status, func.count(Booking.id)).group_by(Booking.status)
        ).all()
    )

    active_subs = db.scalar(
        select(func.count(Subscription.id)).where(
            Subscription.status.in_([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING])
        )
    )
    # Receita recorrente mensal: planos anuais entram rateados por 12.
    mrr = 0
    for sub_plan, count in db.execute(
        select(Plan, func.count(Subscription.id))
        .join(Subscription, Subscription.plan_id == Plan.id)
        .where(Subscription.status == SubscriptionStatus.ACTIVE)
        .group_by(Plan.id)
    ).all():
        monthly = (
            sub_plan.price_cents // 12
            if sub_plan.billing_interval == "yearly"
            else sub_plan.price_cents
        )
        mrr += monthly * count

    top_categories = [
        {"name": name, "slug": slug, "professionals": count}
        for name, slug, count in db.execute(
            select(Category.name, Category.slug, func.count(professional_categories.c.professional_id))
            .join(
                professional_categories,
                professional_categories.c.category_id == Category.id,
                isouter=True,
            )
            .group_by(Category.id)
            .order_by(func.count(professional_categories.c.professional_id).desc())
            .limit(8)
        ).all()
    ]

    # Agrupamos por data (cast), e nao por date_trunc('day', ...): o literal 'day'
    # viraria um parametro vinculado e o Postgres nao casaria SELECT com GROUP BY.
    signup_day = cast(User.created_at, Date).label("day")
    signups = [
        {"date": day.isoformat(), "count": int(count)}
        for day, count in db.execute(
            select(signup_day, func.count(User.id))
            .where(User.created_at >= month_ago)
            .group_by(signup_day)
            .order_by(signup_day)
        ).all()
    ]

    return AdminStats(
        total_users=sum(users_by_role.values()),
        total_clients=users_by_role.get(UserRole.CLIENT, 0),
        total_professionals=users_by_role.get(UserRole.PROFESSIONAL, 0),
        professionals_pending=pros_by_status.get(ProfessionalStatus.PENDING, 0),
        professionals_active=pros_by_status.get(ProfessionalStatus.ACTIVE, 0),
        professionals_suspended=pros_by_status.get(ProfessionalStatus.SUSPENDED, 0),
        total_bookings=sum(bookings_by_status.values()),
        bookings_last_30d=db.scalar(
            select(func.count(Booking.id)).where(Booking.created_at >= month_ago)
        )
        or 0,
        bookings_by_status={k.value: v for k, v in bookings_by_status.items()},
        active_subscriptions=int(active_subs or 0),
        mrr_cents=mrr,
        top_categories=top_categories,
        signups_by_day=signups,
    )


# ---------------------------------------------------------- profissionais ---
@router.get("/professionals", response_model=Page[AdminProfessionalOut])
def list_professionals(
    admin: AdminUser,
    db: DbSession,
    q: str | None = Query(default=None),
    status_filter: ProfessionalStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
) -> Page[AdminProfessionalOut]:
    query = select(Professional).join(User, User.id == Professional.user_id)
    if status_filter:
        query = query.where(Professional.status == status_filter)
    if q and q.strip():
        term = "%" + q.strip().lower() + "%"
        query = query.where(
            func.lower(Professional.display_name).like(term)
            | func.lower(User.email).like(term)
            | func.lower(func.coalesce(Professional.city, "")).like(term)
        )

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(
        query.order_by(Professional.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    ).unique().all()

    ids = [p.id for p in rows]
    services_count = {}
    bookings_count = {}
    subs = {}
    if ids:
        services_count = dict(
            db.execute(
                select(Service.professional_id, func.count(Service.id))
                .where(Service.professional_id.in_(ids))
                .group_by(Service.professional_id)
            ).all()
        )
        bookings_count = dict(
            db.execute(
                select(Booking.professional_id, func.count(Booking.id))
                .where(Booking.professional_id.in_(ids))
                .group_by(Booking.professional_id)
            ).all()
        )
        subs = {
            s.professional_id: s
            for s in db.scalars(
                select(Subscription).where(Subscription.professional_id.in_(ids))
            ).all()
        }

    items = []
    for professional in rows:
        item = AdminProfessionalOut.model_validate(professional)
        item.email = professional.user.email if professional.user else None
        item.services_count = services_count.get(professional.id, 0)
        item.bookings_count = bookings_count.get(professional.id, 0)
        subscription = subs.get(professional.id)
        if subscription:
            item.plan_name = subscription.plan.name
            item.subscription_status = subscription.status
        items.append(item)

    return Page[AdminProfessionalOut](
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=max((total + per_page - 1) // per_page, 1),
    )


@router.patch("/professionals/{professional_id}", response_model=AdminProfessionalOut)
def update_professional(
    professional_id: int,
    payload: AdminProfessionalUpdate,
    admin: AdminUser,
    db: DbSession,
) -> AdminProfessionalOut:
    """Aprovar, suspender, verificar, destacar ou trocar o plano de um profissional."""
    professional = db.get(Professional, professional_id)
    if not professional:
        raise HTTPException(status_code=404, detail="Profissional não encontrado.")

    data = payload.model_dump(exclude_unset=True)
    plan_id = data.pop("plan_id", None)
    subscription_status = data.pop("subscription_status", None)

    if "status" in data and data["status"] != professional.status:
        _log(
            db, admin, "professional.status", "professional", professional.id,
            f"{professional.status.value} -> {data['status'].value}",
        )
        if data["status"] != ProfessionalStatus.SUSPENDED:
            professional.suspension_reason = None

    for field, value in data.items():
        setattr(professional, field, value)

    if plan_id is not None or subscription_status is not None:
        subscription = db.scalar(
            select(Subscription).where(Subscription.professional_id == professional.id)
        )
        now = datetime.now(timezone.utc)

        if plan_id is not None:
            plan = db.get(Plan, plan_id)
            if not plan:
                raise HTTPException(status_code=404, detail="Plano não encontrado.")
            period_days = 365 if plan.billing_interval == "yearly" else 30
            if subscription:
                subscription.plan_id = plan.id
                subscription.current_period_start = now
                subscription.current_period_end = now + timedelta(days=period_days)
            else:
                subscription = Subscription(
                    professional_id=professional.id,
                    plan_id=plan.id,
                    status=SubscriptionStatus.ACTIVE,
                    current_period_start=now,
                    current_period_end=now + timedelta(days=period_days),
                )
                db.add(subscription)
            professional.is_featured = plan.featured_listing
            _log(db, admin, "professional.plan", "professional", professional.id, plan.name)

        if subscription and subscription_status is not None:
            subscription.status = subscription_status
            if subscription_status == SubscriptionStatus.CANCELLED:
                subscription.cancelled_at = now

    db.commit()
    db.refresh(professional)

    item = AdminProfessionalOut.model_validate(professional)
    item.email = professional.user.email if professional.user else None
    return item


@router.delete("/professionals/{professional_id}", response_model=Message)
def delete_professional(professional_id: int, admin: AdminUser, db: DbSession) -> Message:
    """Remove o perfil profissional. A conta de usuario permanece."""
    professional = db.get(Professional, professional_id)
    if not professional:
        raise HTTPException(status_code=404, detail="Profissional não encontrado.")
    _log(db, admin, "professional.delete", "professional", professional.id, professional.slug)
    db.delete(professional)
    db.commit()
    return Message(detail="Perfil profissional removido.")


# ----------------------------------------------------------------- contas ---
@router.get("/users", response_model=Page[AdminUserOut])
def list_users(
    admin: AdminUser,
    db: DbSession,
    q: str | None = Query(default=None),
    role: UserRole | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
) -> Page[AdminUserOut]:
    query = select(User).options(selectinload(User.professional))
    if role:
        query = query.where(User.role == role)
    if is_active is not None:
        query = query.where(User.is_active.is_(is_active))
    if q and q.strip():
        term = "%" + q.strip().lower() + "%"
        query = query.where(func.lower(User.name).like(term) | func.lower(User.email).like(term))

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(
        query.order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    ).unique().all()

    items = []
    for user in rows:
        item = AdminUserOut.model_validate(user)
        item.professional_slug = user.professional.slug if user.professional else None
        items.append(item)

    return Page[AdminUserOut](
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=max((total + per_page - 1) // per_page, 1),
    )


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_user(
    user_id: int, payload: AdminUserUpdate, admin: AdminUser, db: DbSession
) -> AdminUserOut:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado.")

    data = payload.model_dump(exclude_unset=True)

    # Nao deixa o admin logado se auto-bloquear nem se rebaixar.
    if user.id == admin.id:
        if data.get("is_active") is False:
            raise HTTPException(status_code=400, detail="Não pode desativar a sua própria conta.")
        if data.get("role") and data["role"] != UserRole.ADMIN:
            raise HTTPException(status_code=400, detail="Não pode remover o seu próprio acesso.")

    if data.get("is_active") is False:
        _log(db, admin, "user.deactivate", "user", user.id, user.email)

    for field, value in data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)

    item = AdminUserOut.model_validate(user)
    item.professional_slug = user.professional.slug if user.professional else None
    return item


# ------------------------------------------------------------------ planos ---
@router.get("/plans", response_model=list[PlanOut])
def list_all_plans(admin: AdminUser, db: DbSession) -> list[PlanOut]:
    rows = db.scalars(select(Plan).order_by(Plan.sort_order, Plan.price_cents)).all()
    return [PlanOut.model_validate(p) for p in rows]


@router.post("/plans", response_model=PlanOut, status_code=status.HTTP_201_CREATED)
def create_plan(payload: PlanUpsert, admin: AdminUser, db: DbSession) -> PlanOut:
    data = payload.model_dump()
    slug = (data.pop("slug", None) or slugify(payload.name))[:60]
    if db.scalar(select(Plan.id).where(Plan.slug == slug)):
        raise HTTPException(status_code=409, detail="Já existe um plano com este identificador.")

    plan = Plan(slug=slug, **data)
    if plan.is_default:
        db.query(Plan).update({Plan.is_default: False})
    db.add(plan)
    _log(db, admin, "plan.create", "plan", slug, payload.name)
    db.commit()
    db.refresh(plan)
    return PlanOut.model_validate(plan)


@router.put("/plans/{plan_id}", response_model=PlanOut)
def update_plan(plan_id: int, payload: PlanUpsert, admin: AdminUser, db: DbSession) -> PlanOut:
    plan = db.get(Plan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plano não encontrado.")

    data = payload.model_dump()
    new_slug = data.pop("slug", None)
    if new_slug and new_slug != plan.slug:
        if db.scalar(select(Plan.id).where(Plan.slug == new_slug, Plan.id != plan.id)):
            raise HTTPException(status_code=409, detail="Identificador de plano já em uso.")
        plan.slug = new_slug

    if data.get("is_default"):
        db.query(Plan).filter(Plan.id != plan.id).update({Plan.is_default: False})

    for field, value in data.items():
        setattr(plan, field, value)

    _log(db, admin, "plan.update", "plan", plan.id, plan.name)
    db.commit()
    db.refresh(plan)
    return PlanOut.model_validate(plan)


@router.delete("/plans/{plan_id}", response_model=Message)
def delete_plan(plan_id: int, admin: AdminUser, db: DbSession) -> Message:
    plan = db.get(Plan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plano não encontrado.")

    in_use = db.scalar(select(func.count(Subscription.id)).where(Subscription.plan_id == plan.id))
    if in_use:
        # Plano com assinantes e apenas arquivado, para nao quebrar o historico.
        plan.is_active = False
        plan.is_default = False
        db.commit()
        return Message(
            detail=f"Plano desativado: tem {in_use} subscrição(ões) associada(s), por isso não foi removido."
        )

    _log(db, admin, "plan.delete", "plan", plan.id, plan.name)
    db.delete(plan)
    db.commit()
    return Message(detail="Plano removido.")


# ------------------------------------------------- agendamentos e auditoria ---
@router.get("/bookings", response_model=Page[BookingOut])
def list_bookings(
    admin: AdminUser,
    db: DbSession,
    status_filter: BookingStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
) -> Page[BookingOut]:
    query = select(Booking)
    if status_filter:
        query = query.where(Booking.status == status_filter)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(
        query.order_by(Booking.starts_at.desc()).offset((page - 1) * per_page).limit(per_page)
    ).all()

    return Page[BookingOut](
        items=[BookingOut.model_validate(b) for b in rows],
        total=total,
        page=page,
        per_page=per_page,
        pages=max((total + per_page - 1) // per_page, 1),
    )


@router.get("/audit-logs", response_model=list[AuditLogOut])
def list_audit_logs(
    admin: AdminUser, db: DbSession, limit: int = Query(default=50, ge=1, le=200)
) -> list[AuditLogOut]:
    rows = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)).all()
    return [AuditLogOut.model_validate(a) for a in rows]
