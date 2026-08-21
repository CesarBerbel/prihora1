from pydantic import BaseModel, EmailStr, Field

from app.models.enums import UserRole
from app.schemas.common import ORMModel


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    phone: str | None = Field(default=None, max_length=32)
    role: UserRole = UserRole.CLIENT
    # Preenchidos quando role=professional
    display_name: str | None = Field(default=None, max_length=160)
    city: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, max_length=60)
    category_ids: list[int] = Field(default_factory=list)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(ORMModel):
    id: int
    name: str
    email: EmailStr
    phone: str | None = None
    role: UserRole
    is_active: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
    professional_slug: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)
