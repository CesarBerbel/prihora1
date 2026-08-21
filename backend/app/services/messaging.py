"""Envio de mensagens pelos dois canais, com registo do que aconteceu.

Guardamos a mensagem antes de a tentar enviar. Se o canal falhar a meio, fica
o registo do que foi tentado e porquê falhou, em vez de desaparecer.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Message,
    NotificationTrigger,
    MessageChannel,
    MessageStatus,
    Professional,
    ProfessionalClient,
    WhatsappSession,
)
from app.services.whatsapp import WhatsappError
from app.services.whatsapp import send as whatsapp_send

logger = logging.getLogger("prihora.messaging")


def session_row(db: Session, professional_id: int) -> WhatsappSession:
    """Linha de estado da sessão, criada na primeira vez que é precisa."""
    linha = db.scalar(
        select(WhatsappSession).where(WhatsappSession.professional_id == professional_id)
    )
    if linha is None:
        linha = WhatsappSession(professional_id=professional_id)
        db.add(linha)
        db.flush()
    return linha


def sync_session(db: Session, professional_id: int, estado: dict) -> WhatsappSession:
    """Copia para a base o estado que o serviço de WhatsApp reportou."""
    linha = session_row(db, professional_id)
    linha.status = estado.get("status", "disconnected")
    linha.phone_number = estado.get("phone_number")
    linha.last_error = estado.get("last_error")

    ligado = estado.get("connected_at")
    if ligado:
        try:
            linha.connected_at = datetime.fromisoformat(ligado.replace("Z", "+00:00"))
        except ValueError:
            pass
    elif linha.status != "connected":
        linha.connected_at = None

    return linha


def _destinatario(cliente: ProfessionalClient | None, avulso: str | None) -> str:
    if avulso and avulso.strip():
        return avulso.strip()
    return (cliente.phone if cliente else "") or ""


def send_message(
    db: Session,
    professional: Professional,
    *,
    body: str,
    client: ProfessionalClient | None = None,
    recipient: str | None = None,
    booking_id: int | None = None,
    trigger: NotificationTrigger | None = None,
) -> Message:
    destino = _destinatario(client, recipient)
    if not destino:
        raise ValueError(
            "Este cliente não tem telefone registado. Indique um destinatário."
        )

    mensagem = Message(
        professional_id=professional.id,
        professional_client_id=client.id if client else None,
        booking_id=booking_id,
        channel=MessageChannel.WHATSAPP,
        recipient=destino,
        recipient_name=client.name if client else None,
        body=body,
        status=MessageStatus.QUEUED,
        trigger=trigger,
    )
    db.add(mensagem)
    db.flush()

    try:
        resultado = whatsapp_send(professional.id, destino, body)
        mensagem.external_id = resultado.get("id")

        linha = session_row(db, professional.id)
        linha.messages_sent = (linha.messages_sent or 0) + 1

        mensagem.status = MessageStatus.SENT
        mensagem.sent_at = datetime.now(timezone.utc)

    except WhatsappError as erro:
        # Falhar não apaga o registo: fica o que foi tentado e o motivo.
        mensagem.status = MessageStatus.FAILED
        mensagem.error = str(erro)
        logger.info("Mensagem %s falhou: %s", mensagem.id, erro)

    db.commit()
    db.refresh(mensagem)
    return mensagem
