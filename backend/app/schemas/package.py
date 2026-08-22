from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator

from app.models.enums import PackageKind, PackageSaleStatus
from app.schemas.common import ORMModel


class PackageServiceOut(BaseModel):
    id: int
    name: str
    duration_min: int
    price_cents: int


class PackageOut(ORMModel):
    id: int
    name: str
    description: str | None = None
    kind: PackageKind
    price_cents: int
    sessions: int
    validity_days: int
    is_active: bool
    created_at: datetime

    services: list[PackageServiceOut] = []
    # Quanto custaria comprar o mesmo à parte, e quanto se poupa — que é a
    # razão de existir de um pacote.
    retail_cents: int = 0
    savings_cents: int = 0
    duration_min: int = 0
    sold_count: int = 0


class PackageIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    kind: PackageKind = PackageKind.SESSIONS
    price_cents: int = Field(ge=0)
    sessions: int = Field(default=1, ge=1, le=100)
    validity_days: int = Field(default=0, ge=0, le=1095)
    is_active: bool = True
    service_ids: list[int] = Field(min_length=1, max_length=12)

    @model_validator(mode="after")
    def coerente(self) -> "PackageIn":
        """Cada feitio de pacote tem uma forma só de fazer sentido."""
        if self.kind == PackageKind.SESSIONS:
            if len(self.service_ids) != 1:
                raise ValueError("Um pacote de sessões repete um serviço só.")
            if self.sessions < 2:
                raise ValueError("Um pacote de sessões precisa de pelo menos duas.")
        else:
            if len(self.service_ids) < 2:
                raise ValueError("Um pacote combinado junta pelo menos dois serviços.")
            # Num combinado tudo acontece de seguida: sessões não se aplicam.
            self.sessions = 1
        return self


class PackageSaleOut(ORMModel):
    id: int
    package_id: int | None = None
    client_id: int
    package_name: str
    kind: PackageKind
    price_cents: int
    sessions_total: int
    sessions_used: int
    sessions_left: int = 0
    expires_on: date | None = None
    status: PackageSaleStatus
    notes: str | None = None
    created_at: datetime

    client_name: str | None = None
    client_phone: str | None = None
    services: list[PackageServiceOut] = []
    available: bool = False
    unavailable_reason: str | None = None


class PackageSaleIn(BaseModel):
    package_id: int
    client_id: int
    notes: str | None = Field(default=None, max_length=500)
