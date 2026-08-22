from datetime import datetime

from sqlalchemy import (
    Boolean, DateTime, Enum, ForeignKey, Index, Integer, String, Text,
    UniqueConstraint, text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.enums import BookingStatus, SubscriptionStatus
from app.models.user import utcnow


class Booking(Base):
    """Agendamento entre um cliente e um profissional."""

    __tablename__ = "bookings"
    __table_args__ = (
        Index("ix_booking_pro_window", "professional_id", "starts_at", "ends_at"),
        Index("ix_booking_status_start", "status", "starts_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(12), unique=True, index=True, nullable=False)

    professional_id: Mapped[int] = mapped_column(
        ForeignKey("professionals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    service_id: Mapped[int | None] = mapped_column(
        ForeignKey("services.id", ondelete="SET NULL"), index=True
    )
    # Nulo quando o agendamento e feito por um visitante sem conta.
    client_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    # Ficha do cliente na agenda particular do profissional.
    professional_client_id: Mapped[int | None] = mapped_column(
        ForeignKey("professional_clients.id", ondelete="SET NULL"), index=True
    )
    # De que saldo de pacote saiu esta marcação, quando saiu de um.
    package_sale_id: Mapped[int | None] = mapped_column(
        ForeignKey("package_sales.id", ondelete="SET NULL")
    )

    client_name: Mapped[str] = mapped_column(String(160), nullable=False)
    client_phone: Mapped[str] = mapped_column(String(32), nullable=False)
    client_email: Mapped[str | None] = mapped_column(String(255))

    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    status: Mapped[BookingStatus] = mapped_column(
        Enum(BookingStatus, name="booking_status", values_callable=lambda e: [i.value for i in e]),
        default=BookingStatus.PENDING,
        nullable=False,
        index=True,
    )
    service_name: Mapped[str] = mapped_column(String(160), default="")
    price_cents: Mapped[int] = mapped_column(Integer, default=0)
    at_home: Mapped[bool] = mapped_column(Boolean, default=False)
    address_line: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)
    cancel_reason: Mapped[str | None] = mapped_column(String(255))
    # Lancado pelo profissional no painel, e nao pela agenda publica. Esses
    # podem cair fora do horario de atendimento e por cima de bloqueios.
    # server_default e o que permite adicionar a coluna em uma tabela que ja
    # tem linhas: sem ele, o NOT NULL nao teria valor para o historico.
    created_by_professional: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default=text("false")
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    professional = relationship("Professional", back_populates="bookings")
    service = relationship("Service", back_populates="bookings")
    client = relationship("User")
    professional_client = relationship("ProfessionalClient", back_populates="bookings")
    review = relationship("Review", back_populates="booking", uselist=False)

    BLOCKING_STATUSES = (BookingStatus.PENDING, BookingStatus.CONFIRMED)


class Review(Base):
    """Avaliacao publica deixada apos um atendimento concluido."""

    __tablename__ = "reviews"
    __table_args__ = (UniqueConstraint("booking_id", name="uq_review_booking"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    professional_id: Mapped[int] = mapped_column(
        ForeignKey("professionals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    booking_id: Mapped[int | None] = mapped_column(
        ForeignKey("bookings.id", ondelete="SET NULL")
    )
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    author_name: Mapped[str] = mapped_column(String(160), nullable=False)

    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1 a 5
    comment: Mapped[str | None] = mapped_column(Text)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    professional = relationship("Professional", back_populates="reviews")
    booking = relationship("Booking", back_populates="review")


class Subscription(Base):
    """Assinatura que liga um profissional a um plano."""

    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    professional_id: Mapped[int] = mapped_column(
        ForeignKey("professionals.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    plan_id: Mapped[int] = mapped_column(ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False)

    status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(
            SubscriptionStatus,
            name="subscription_status",
            values_callable=lambda e: [i.value for i in e],
        ),
        default=SubscriptionStatus.TRIALING,
        nullable=False,
        index=True,
    )
    current_period_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    professional = relationship("Professional", back_populates="subscription")
    plan = relationship("Plan", back_populates="subscriptions", lazy="joined")


class AuditLog(Base):
    """Trilha de acoes administrativas."""

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    actor_email: Mapped[str | None] = mapped_column(String(255))
    action: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    entity: Mapped[str] = mapped_column(String(60), nullable=False)
    entity_id: Mapped[str | None] = mapped_column(String(60))
    detail: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
