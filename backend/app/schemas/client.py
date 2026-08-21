from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.booking import BookingOut
from app.schemas.common import ORMModel


class ClientOut(ORMModel):
    id: int
    name: str
    phone: str | None = None
    email: str | None = None
    birth_date: date | None = None
    address_line: str | None = None
    notes: str | None = None
    is_active: bool
    created_from_booking: bool
    created_at: datetime
    # Calculados na listagem.
    bookings_count: int = 0
    last_visit_at: datetime | None = None


class ClientUpsert(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    phone: str | None = Field(default=None, max_length=32)
    email: EmailStr | None = None
    birth_date: date | None = None
    address_line: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=2000)
    is_active: bool = True


class ClientDetail(ClientOut):
    """Ficha completa, com o historico de atendimentos."""

    bookings: list[BookingOut] = []
