"""Regras das mensagens automáticas, uma por gatilho e por profissional."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.enums import NotificationTrigger
from app.models.user import utcnow


class NotificationRule(Base):
    """O que sai, por onde e para quem, em cada momento da marcação.

    Uma linha por gatilho. O modelo de texto vive aqui e não no código porque
    cada profissional escreve à sua maneira; os valores por omissão são
    semeados na criação do perfil.
    """

    __tablename__ = "notification_rules"
    __table_args__ = (
        UniqueConstraint("professional_id", "trigger", name="uq_rule_pro_trigger"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    professional_id: Mapped[int] = mapped_column(
        ForeignKey("professionals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    trigger: Mapped[NotificationTrigger] = mapped_column(
        Enum(
            NotificationTrigger,
            name="notification_trigger",
            values_callable=lambda e: [i.value for i in e],
        ),
        nullable=False,
    )

    # Cada destinatário tem o seu interruptor e o seu texto: o que se diz ao
    # cliente ("a sua marcação está confirmada") e o que se diz ao profissional
    # ("nova marcação de X") são mensagens diferentes, não a mesma repetida.
    to_client: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    client_body: Mapped[str] = mapped_column(Text, nullable=False, default="")

    to_professional: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    professional_body: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Só para os lembretes: minutos antes (REMINDER_BEFORE) ou depois
    # (REMINDER_AFTER) da hora do atendimento.
    offset_minutes: Mapped[int] = mapped_column(Integer, default=120, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    professional = relationship("Professional", back_populates="notification_rules")

    @property
    def is_active(self) -> bool:
        """Sai alguma coisa se houver pelo menos um destinatário ligado."""
        return self.to_client or self.to_professional

    def body_for(self, audience: str) -> str:
        """Texto deste destinatário: "client" ou "professional"."""
        return self.client_body if audience == "client" else self.professional_body
