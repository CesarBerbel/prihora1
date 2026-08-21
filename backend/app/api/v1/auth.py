"""Cadastro, login e dados da conta autenticada."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.core.security import create_access_token, hash_password, verify_password
from app.models import Category, Plan, Professional, ProfessionalStatus, Subscription, User, UserRole
from app.models.enums import SubscriptionStatus
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
)
from app.schemas.common import Message
from app.services.slug import unique_professional_slug

router = APIRouter(prefix="/auth", tags=["auth"])


def _default_plan(db: DbSession) -> Plan | None:
    plan = db.scalar(select(Plan).where(Plan.is_default.is_(True), Plan.is_active.is_(True)))
    if plan:
        return plan
    return db.scalar(select(Plan).where(Plan.is_active.is_(True)).order_by(Plan.price_cents))


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: DbSession) -> TokenResponse:
    email = payload.email.lower().strip()

    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe uma conta com este e-mail.",
        )

    # Cadastro publico nunca cria administradores.
    role = payload.role if payload.role != UserRole.ADMIN else UserRole.CLIENT

    user = User(
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        phone=payload.phone,
        role=role,
    )
    db.add(user)
    db.flush()

    professional_slug = None
    if role == UserRole.PROFESSIONAL:
        display_name = (payload.display_name or payload.name).strip()
        professional = Professional(
            user_id=user.id,
            slug=unique_professional_slug(db, display_name),
            display_name=display_name,
            city=payload.city,
            state=(payload.state or "").strip() or None,
            status=ProfessionalStatus.PENDING,
        )
        if payload.category_ids:
            professional.categories = list(
                db.scalars(select(Category).where(Category.id.in_(payload.category_ids))).all()
            )
        db.add(professional)
        db.flush()

        plan = _default_plan(db)
        if plan:
            now = datetime.now(timezone.utc)
            db.add(
                Subscription(
                    professional_id=professional.id,
                    plan_id=plan.id,
                    status=(
                        SubscriptionStatus.TRIALING
                        if plan.trial_days
                        else SubscriptionStatus.ACTIVE
                    ),
                    current_period_start=now,
                    current_period_end=now + timedelta(days=plan.trial_days or 30),
                )
            )
        professional_slug = professional.slug

    db.commit()
    db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(user.id, user.role.value),
        user=UserOut.model_validate(user),
        professional_slug=professional_slug,
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: DbSession) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower().strip()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou palavra-passe inválidos."
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta conta está desativada. Fale connosco.",
        )

    professional = db.scalar(select(Professional).where(Professional.user_id == user.id))

    return TokenResponse(
        access_token=create_access_token(user.id, user.role.value),
        user=UserOut.model_validate(user),
        professional_slug=professional.slug if professional else None,
    )


@router.get("/me", response_model=TokenResponse)
def me(user: CurrentUser, db: DbSession) -> TokenResponse:
    professional = db.scalar(select(Professional).where(Professional.user_id == user.id))
    return TokenResponse(
        access_token=create_access_token(user.id, user.role.value),
        user=UserOut.model_validate(user),
        professional_slug=professional.slug if professional else None,
    )


@router.post("/change-password", response_model=Message)
def change_password(payload: ChangePasswordRequest, user: CurrentUser, db: DbSession) -> Message:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Palavra-passe atual incorreta.")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return Message(detail="Palavra-passe alterada.")
