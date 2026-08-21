from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.models.enums import MessageChannel, MessageStatus, NotificationTrigger
from app.schemas.common import ORMModel


class MessageOut(ORMModel):
    id: int
    channel: MessageChannel
    recipient: str
    recipient_name: str | None = None
    subject: str | None = None
    body: str
    status: MessageStatus
    error: str | None = None
    # Gatilho que a originou; nulo quando foi escrita à mão.
    trigger: NotificationTrigger | None = None
    professional_client_id: int | None = None
    created_at: datetime
    sent_at: datetime | None = None


class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)
    # Ficha do cliente, ou um número escrito à mão.
    client_id: int | None = None
    recipient: str | None = Field(default=None, max_length=255)
    booking_id: int | None = None

    @model_validator(mode="after")
    def validar(self) -> "MessageCreate":
        if self.client_id is None and not (self.recipient and self.recipient.strip()):
            raise ValueError("Escolha um cliente ou indique o número de telefone.")
        return self


class WhatsappStatus(BaseModel):
    """Estado da ligação de WhatsApp do profissional."""

    status: str
    # Imagem do QR em data URL, só enquanto for válido.
    qr: str | None = None
    phone_number: str | None = None
    connected_at: datetime | None = None
    last_error: str | None = None
    messages_sent: int = 0
    enabled: bool = True


class ChannelsStatus(BaseModel):
    whatsapp: WhatsappStatus
