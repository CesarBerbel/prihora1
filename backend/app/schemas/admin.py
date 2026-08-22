from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import ProfessionalStatus, SubscriptionStatus, UserRole
from app.schemas.catalog import PlanOut
from app.schemas.common import ORMModel


class AdminStats(BaseModel):
    total_users: int
    total_clients: int
    total_professionals: int
    professionals_pending: int
    professionals_active: int
    professionals_suspended: int
    total_bookings: int
    bookings_last_30d: int
    bookings_by_status: dict[str, int]
    active_subscriptions: int
    mrr_cents: int
    top_categories: list[dict]
    signups_by_day: list[dict]


class AdminUserOut(ORMModel):
    id: int
    name: str
    email: str
    phone: str | None = None
    role: UserRole
    is_active: bool
    created_at: datetime
    professional_slug: str | None = None


class AdminUserUpdate(BaseModel):
    is_active: bool | None = None
    role: UserRole | None = None
    name: str | None = Field(default=None, max_length=160)


class AdminProfessionalOut(ORMModel):
    id: int
    slug: str
    display_name: str
    email: str | None = None
    city: str | None = None
    state: str | None = None
    status: ProfessionalStatus
    is_verified: bool
    is_featured: bool
    rating_avg: float
    rating_count: int
    completed_bookings: int
    services_count: int = 0
    bookings_count: int = 0
    plan_name: str | None = None
    subscription_status: SubscriptionStatus | None = None
    suspension_reason: str | None = None
    created_at: datetime


class AdminProfessionalUpdate(BaseModel):
    status: ProfessionalStatus | None = None
    is_verified: bool | None = None
    is_featured: bool | None = None
    suspension_reason: str | None = Field(default=None, max_length=500)
    plan_id: int | None = None
    subscription_status: SubscriptionStatus | None = None


class AuditLogOut(ORMModel):
    id: int
    actor_email: str | None = None
    action: str
    entity: str
    entity_id: str | None = None
    detail: str | None = None
    created_at: datetime


class SubscriptionOut(ORMModel):
    id: int
    professional_id: int
    status: SubscriptionStatus
    current_period_start: datetime
    current_period_end: datetime | None = None
    plan: PlanOut


class ChangePlanRequest(BaseModel):
    plan_id: int


class PreviewLink(BaseModel):
    """Endereço temporário para ver um perfil que ainda não está público."""

    url: str
    expires_minutes: int


class AdminCategoryOut(ORMModel):
    id: int
    slug: str
    name: str
    description: str | None = None
    icon: str
    sort_order: int
    is_active: bool
    professional_count: int = 0
