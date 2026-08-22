from datetime import datetime, time

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import ProfessionalStatus
from app.schemas.catalog import CategoryOut, PlanOut
from app.schemas.common import ORMModel


# --------------------------------------------------------------- servicos ----
class ServiceOut(ORMModel):
    id: int
    name: str
    description: str | None = None
    duration_min: int
    price_cents: int
    is_active: bool
    category_id: int | None = None
    sort_order: int = 100


class ServiceSuggestion(BaseModel):
    """Serviço de exemplo, pronto a acrescentar com um toque."""

    name: str
    duration_min: int
    price_cents: int
    category_id: int | None = None
    category_name: str | None = None


class ServiceUpsert(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    description: str | None = None
    duration_min: int = Field(ge=5, le=600, default=60)
    price_cents: int = Field(ge=0, default=0)
    category_id: int | None = None
    is_active: bool = True
    sort_order: int = 100


# ------------------------------------------------------------ disponibil. ----
class AvailabilityOut(ORMModel):
    id: int
    weekday: int
    start_time: time
    end_time: time


class AvailabilityIn(BaseModel):
    weekday: int = Field(ge=0, le=6)
    start_time: time
    end_time: time


class AvailabilityBulk(BaseModel):
    """Substitui toda a grade semanal do profissional."""

    items: list[AvailabilityIn]


class TimeOffOut(ORMModel):
    id: int
    starts_at: datetime
    ends_at: datetime
    reason: str | None = None


class TimeOffIn(BaseModel):
    starts_at: datetime
    ends_at: datetime
    reason: str | None = Field(default=None, max_length=200)


# ------------------------------------------------------------ avaliacoes ----
class ReviewOut(ORMModel):
    id: int
    author_name: str
    rating: int
    comment: str | None = None
    created_at: datetime


class MyReviewOut(ReviewOut):
    """A mesma avaliação, com o que só o dono do perfil precisa de ver."""

    service_name: str | None = None
    booking_code: str | None = None
    is_published: bool = True


class ReviewIn(BaseModel):
    booking_code: str = Field(min_length=4, max_length=12)
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1200)


# ----------------------------------------------------------- profissional ----
class ProfessionalCard(ORMModel):
    """Versao enxuta usada em listagens e resultados de busca."""

    id: int
    slug: str
    display_name: str
    headline: str | None = None
    avatar_url: str | None = None
    city: str | None = None
    state: str | None = None
    neighborhood: str | None = None
    rating_avg: float
    rating_count: int
    # Mostrado sempre, mesmo a zero: um perfil novo com "0 atendimentos" diz
    # mais do que um perfil sem o número nenhum, que parece uma omissão.
    completed_bookings: int = 0
    is_verified: bool
    is_featured: bool
    serves_at_home: bool
    serves_at_studio: bool
    categories: list[CategoryOut] = []
    distance_km: float | None = None
    price_from_cents: int | None = None
    # Camada do resultado: "region", "elsewhere" ou "featured".
    group: str = "region"


class ProfessionalPublic(ProfessionalCard):
    """Perfil publico completo."""

    bio: str | None = None
    cover_url: str | None = None
    public_phone: str | None = None
    whatsapp: str | None = None
    instagram: str | None = None
    address_line: str | None = None
    postal_code: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    home_service_radius_km: int = 10
    timezone: str = "Europe/Lisbon"
    min_notice_hours: int = 2
    max_advance_days: int = 60
    cancel_notice_hours: int = 24
    completed_bookings: int = 0
    services: list[ServiceOut] = []
    availabilities: list[AvailabilityOut] = []
    created_at: datetime


class ProfessionalPrivate(ProfessionalPublic):
    """Inclui campos que so o dono ou o admin enxerga."""

    user_id: int
    status: ProfessionalStatus
    slot_interval_min: int
    auto_confirm: bool
    serves_at_studio: bool
    suspension_reason: str | None = None
    profile_views: int = 0
    plan: PlanOut | None = None


class ProfessionalUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=2, max_length=160)
    headline: str | None = Field(default=None, max_length=200)
    bio: str | None = None
    avatar_url: str | None = Field(default=None, max_length=500)
    cover_url: str | None = Field(default=None, max_length=500)
    public_phone: str | None = Field(default=None, max_length=32)
    whatsapp: str | None = Field(default=None, max_length=32)
    instagram: str | None = Field(default=None, max_length=120)
    address_line: str | None = Field(default=None, max_length=255)
    neighborhood: str | None = Field(default=None, max_length=120)
    city: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, max_length=60)
    postal_code: str | None = Field(default=None, max_length=16)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    serves_at_studio: bool | None = None
    serves_at_home: bool | None = None
    home_service_radius_km: int | None = Field(default=None, ge=1, le=200)
    timezone: str | None = Field(default=None, max_length=64)
    slot_interval_min: int | None = Field(default=None, ge=5, le=240)
    min_notice_hours: int | None = Field(default=None, ge=0, le=720)
    max_advance_days: int | None = Field(default=None, ge=1, le=365)
    cancel_notice_hours: int | None = Field(default=None, ge=0, le=720)
    auto_confirm: bool | None = None
    category_ids: list[int] | None = None
    publish: bool | None = None
