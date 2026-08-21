from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class CategoryOut(ORMModel):
    id: int
    slug: str
    name: str
    description: str | None = None
    icon: str
    professional_count: int | None = None


class CityOut(ORMModel):
    id: int
    name: str
    state: str
    slug: str
    latitude: float
    longitude: float


class PlanOut(ORMModel):
    id: int
    slug: str
    name: str
    description: str | None = None
    price_cents: int
    billing_interval: str
    max_services: int
    max_photos: int
    max_bookings_per_month: int
    featured_listing: bool
    online_agenda: bool
    analytics: bool
    priority_support: bool
    trial_days: int
    is_active: bool
    is_default: bool
    sort_order: int


class PlanUpsert(BaseModel):
    slug: str | None = Field(default=None, max_length=60)
    name: str = Field(min_length=2, max_length=120)
    description: str | None = None
    price_cents: int = Field(ge=0, default=0)
    billing_interval: str = "monthly"
    max_services: int = Field(ge=0, default=5)
    max_photos: int = Field(ge=0, default=5)
    max_bookings_per_month: int = Field(ge=0, default=50)
    featured_listing: bool = False
    online_agenda: bool = True
    analytics: bool = False
    priority_support: bool = False
    trial_days: int = Field(ge=0, default=0)
    is_active: bool = True
    is_default: bool = False
    sort_order: int = 100


class ReverseGeocodeOut(BaseModel):
    """Morada aproximada de um par de coordenadas."""

    latitude: float
    longitude: float
    address_line: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    # "nominatim" quando veio do serviço externo, "cidades" quando foi
    # deduzido da cidade conhecida mais próxima.
    source: str
