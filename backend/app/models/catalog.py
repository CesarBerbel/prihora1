from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer, String, Table, Text, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.user import utcnow

# Relacao N:N entre profissionais e categorias de atuacao.
professional_categories = Table(
    "professional_categories",
    Base.metadata,
    Column("professional_id", ForeignKey("professionals.id", ondelete="CASCADE"), primary_key=True),
    Column("category_id", ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True),
)


class Category(Base):
    """Especialidade da area de estetica (manicure, tatuagem, podologia...)."""

    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    icon: Mapped[str] = mapped_column(String(16), default="sparkles")
    sort_order: Mapped[int] = mapped_column(Integer, default=100)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    professionals = relationship(
        "Professional", secondary=professional_categories, back_populates="categories"
    )


class City(Base):
    """Cidades com coordenadas, usadas na busca por localidade."""

    __tablename__ = "cities"
    __table_args__ = (UniqueConstraint("name", "state", name="uq_city_name_state"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    # Distrito. Ver a nota em Professional.state.
    state: Mapped[str] = mapped_column(String(60), index=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True, nullable=False)
    latitude: Mapped[float] = mapped_column(nullable=False)
    longitude: Mapped[float] = mapped_column(nullable=False)
    population: Mapped[int] = mapped_column(Integer, default=0)


class Plan(Base):
    """Plano de assinatura oferecido aos profissionais."""

    __tablename__ = "plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    price_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    billing_interval: Mapped[str] = mapped_column(String(16), default="monthly")

    # Limites e beneficios
    max_services: Mapped[int] = mapped_column(Integer, default=5)
    max_photos: Mapped[int] = mapped_column(Integer, default=5)
    max_bookings_per_month: Mapped[int] = mapped_column(Integer, default=50)
    featured_listing: Mapped[bool] = mapped_column(Boolean, default=False)
    online_agenda: Mapped[bool] = mapped_column(Boolean, default=True)
    analytics: Mapped[bool] = mapped_column(Boolean, default=False)
    priority_support: Mapped[bool] = mapped_column(Boolean, default=False)

    trial_days: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=100)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    subscriptions = relationship("Subscription", back_populates="plan")
