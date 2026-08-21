"""Centro de mensagens: o que foi enviado, por que canal e com que resultado."""

from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.enums import MessageChannel, MessageStatus, NotificationTrigger
from app.models.user import utcnow


class Message(Base):
    """Uma mensagem enviada por um profissional a um cliente.

    Guardamos o texto tal como saiu, e não apenas o modelo que lhe deu origem:
    o modelo muda com o tempo e o histórico tem de continuar a dizer o que a
    pessoa recebeu de facto.
    """

    __tablename__ = "messages"
    __table_args__ = (Index("ix_message_pro_created", "professional_id", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    professional_id: Mapped[int] = mapped_column(
        ForeignKey("professionals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    professional_client_id: Mapped[int | None] = mapped_column(
        ForeignKey("professional_clients.id", ondelete="SET NULL"), index=True
    )
    booking_id: Mapped[int | None] = mapped_column(
        ForeignKey("bookings.id", ondelete="SET NULL"), index=True
    )

    channel: Mapped[MessageChannel] = mapped_column(
        Enum(
            MessageChannel,
            name="message_channel",
            values_callable=lambda e: [i.value for i in e],
        ),
        nullable=False,
        index=True,
    )
    # Telefone ou e-mail, consoante o canal.
    recipient: Mapped[str] = mapped_column(String(255), nullable=False)
    recipient_name: Mapped[str | None] = mapped_column(String(160))
    subject: Mapped[str | None] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, nullable=False)

    status: Mapped[MessageStatus] = mapped_column(
        Enum(
            MessageStatus,
            name="message_status",
            values_callable=lambda e: [i.value for i in e],
        ),
        default=MessageStatus.QUEUED,
        nullable=False,
        index=True,
    )
    error: Mapped[str | None] = mapped_column(Text)
    # Identificador devolvido pelo canal, para cruzar com o WhatsApp.
    external_id: Mapped[str | None] = mapped_column(String(120))

    # Gatilho que deu origem à mensagem. Nulo quando foi escrita à mão.
    # Guardado também para não repetir o mesmo aviso da mesma marcação.
    trigger: Mapped[NotificationTrigger | None] = mapped_column(
        Enum(
            NotificationTrigger,
            name="notification_trigger",
            values_callable=lambda e: [i.value for i in e],
        ),
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    professional = relationship("Professional", back_populates="messages")
    client = relationship("ProfessionalClient")


class WhatsappSession(Base):
    """Estado da ligação de WhatsApp de cada profissional.

    As credenciais ficam no serviço de WhatsApp, em ficheiros. Aqui guardamos
    apenas o suficiente para a interface saber o que mostrar sem ter de bater
    no serviço a cada carregamento de página.
    """

    __tablename__ = "whatsapp_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    professional_id: Mapped[int] = mapped_column(
        ForeignKey("professionals.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), default="disconnected", nullable=False)
    phone_number: Mapped[str | None] = mapped_column(String(32))
    connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    messages_sent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    professional = relationship("Professional", back_populates="whatsapp_session")
