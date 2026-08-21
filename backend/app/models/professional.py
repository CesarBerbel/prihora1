from datetime import date, datetime, time

from sqlalchemy import (
    Boolean, Date, DateTime, Enum, Float, ForeignKey, Index, Integer, Numeric,
    String, Text, Time, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.catalog import professional_categories
from app.models.enums import ProfessionalStatus
from app.models.user import utcnow


class Professional(Base):
    """Perfil publico de um profissional liberal da area de estetica."""

    __tablename__ = "professionals"
    __table_args__ = (
        Index("ix_professional_geo", "latitude", "longitude"),
        Index("ix_professional_city_status", "city", "state", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    # Identidade publica
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(160), nullable=False)
    headline: Mapped[str | None] = mapped_column(String(200))
    bio: Mapped[str | None] = mapped_column(Text)
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    cover_url: Mapped[str | None] = mapped_column(String(500))

    # Contato
    public_phone: Mapped[str | None] = mapped_column(String(32))
    whatsapp: Mapped[str | None] = mapped_column(String(32))
    instagram: Mapped[str | None] = mapped_column(String(120))

    # Localizacao
    address_line: Mapped[str | None] = mapped_column(String(255))
    neighborhood: Mapped[str | None] = mapped_column(String(120), index=True)
    city: Mapped[str | None] = mapped_column(String(120), index=True)
    # Distrito em Portugal. Cabe nome por extenso, não sigla de duas letras.
    state: Mapped[str | None] = mapped_column(String(60), index=True)
    postal_code: Mapped[str | None] = mapped_column(String(16))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)

    # Modalidades de atendimento
    serves_at_studio: Mapped[bool] = mapped_column(Boolean, default=True)
    serves_at_home: Mapped[bool] = mapped_column(Boolean, default=False)
    home_service_radius_km: Mapped[int] = mapped_column(Integer, default=10)

    # Agenda
    timezone: Mapped[str] = mapped_column(String(64), default="Europe/Lisbon")
    slot_interval_min: Mapped[int] = mapped_column(Integer, default=30)
    min_notice_hours: Mapped[int] = mapped_column(Integer, default=2)
    max_advance_days: Mapped[int] = mapped_column(Integer, default=60)
    auto_confirm: Mapped[bool] = mapped_column(Boolean, default=False)

    # Estado no marketplace
    status: Mapped[ProfessionalStatus] = mapped_column(
        Enum(
            ProfessionalStatus,
            name="professional_status",
            values_callable=lambda e: [i.value for i in e],
        ),
        default=ProfessionalStatus.PENDING,
        nullable=False,
        index=True,
    )
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    suspension_reason: Mapped[str | None] = mapped_column(Text)

    # Reputacao (desnormalizada para ordenar a busca)
    # --- financeiro -------------------------------------------------------
    # Percentagem do valor de cada atendimento que o profissional deve a
    # terceiros — o espaço onde atende, a sala que aluga, quem lhe passa
    # clientes. Zero para quem não deve nada a ninguém, que é o caso comum.
    # O prihora não cobra comissão: este número é do negócio dele, não nosso.
    commission_percent: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    rating_avg: Mapped[float] = mapped_column(Float, default=0.0)
    rating_count: Mapped[int] = mapped_column(Integer, default=0)
    completed_bookings: Mapped[int] = mapped_column(Integer, default=0)
    profile_views: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    user = relationship("User", back_populates="professional")
    categories = relationship(
        "Category", secondary=professional_categories, back_populates="professionals", lazy="selectin"
    )
    services = relationship(
        "Service", back_populates="professional", cascade="all, delete-orphan", lazy="selectin"
    )
    availabilities = relationship(
        "Availability", back_populates="professional", cascade="all, delete-orphan"
    )
    time_offs = relationship(
        "TimeOff", back_populates="professional", cascade="all, delete-orphan"
    )
    bookings = relationship("Booking", back_populates="professional", cascade="all, delete-orphan")
    expenses = relationship(
        "Expense", back_populates="professional", cascade="all, delete-orphan"
    )
    clients = relationship(
        "ProfessionalClient", back_populates="professional", cascade="all, delete-orphan"
    )
    messages = relationship(
        "Message", back_populates="professional", cascade="all, delete-orphan"
    )
    notification_rules = relationship(
        "NotificationRule", back_populates="professional", cascade="all, delete-orphan"
    )
    whatsapp_session = relationship(
        "WhatsappSession", back_populates="professional", uselist=False,
        cascade="all, delete-orphan",
    )
    reviews = relationship("Review", back_populates="professional", cascade="all, delete-orphan")
    subscription = relationship(
        "Subscription", back_populates="professional", uselist=False,
        cascade="all, delete-orphan",
    )

    @property
    def is_public(self) -> bool:
        return self.status == ProfessionalStatus.ACTIVE


class Service(Base):
    """Servico ofertado por um profissional, com duracao e preco."""

    __tablename__ = "services"

    id: Mapped[int] = mapped_column(primary_key=True)
    professional_id: Mapped[int] = mapped_column(
        ForeignKey("professionals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), index=True
    )

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    duration_min: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    price_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=100)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    professional = relationship("Professional", back_populates="services")
    category = relationship("Category", lazy="joined")
    bookings = relationship("Booking", back_populates="service")


class Availability(Base):
    """Janela recorrente de atendimento (ex.: segunda, 09:00-18:00)."""

    __tablename__ = "availabilities"
    __table_args__ = (
        UniqueConstraint(
            "professional_id", "weekday", "start_time", name="uq_availability_slot"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    professional_id: Mapped[int] = mapped_column(
        ForeignKey("professionals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=segunda ... 6=domingo
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)

    professional = relationship("Professional", back_populates="availabilities")


class TimeOff(Base):
    """Bloqueio pontual na agenda (folga, ferias, compromisso)."""

    __tablename__ = "time_offs"

    id: Mapped[int] = mapped_column(primary_key=True)
    professional_id: Mapped[int] = mapped_column(
        ForeignKey("professionals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(200))

    professional = relationship("Professional", back_populates="time_offs")
