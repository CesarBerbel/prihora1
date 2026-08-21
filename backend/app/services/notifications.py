"""Despacho das mensagens automáticas ligadas às marcações."""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Booking,
    Message,
    MessageStatus,
    NotificationRule,
    NotificationTrigger,
    Professional,
    ProfessionalClient,
)
from app.services.messaging import send_message
from app.services.templates import DEFAULTS, build_context, render

logger = logging.getLogger("prihora.notifications")

def ensure_rules(db: Session, professional: Professional) -> list[NotificationRule]:
    """Garante uma regra por gatilho, criando as que faltarem com os valores base.

    Corre à chegada ao painel e antes de qualquer despacho: assim, perfis
    criados antes desta funcionalidade — ou gatilhos acrescentados depois —
    aparecem sem precisar de migração de dados.
    """
    existentes = {
        r.trigger: r
        for r in db.scalars(
            select(NotificationRule).where(
                NotificationRule.professional_id == professional.id
            )
        ).all()
    }

    criadas = False
    for gatilho, base in DEFAULTS.items():
        if gatilho in existentes:
            continue
        regra = NotificationRule(
            professional_id=professional.id,
            trigger=gatilho,
            to_client=base["to_client"],
            to_professional=base["to_professional"],
            offset_minutes=base["offset_minutes"],
            client_body=base["client_body"],
            professional_body=base["professional_body"],
        )
        db.add(regra)
        existentes[gatilho] = regra
        criadas = True

    if criadas:
        db.flush()

    return [existentes[g] for g in DEFAULTS]


def get_rule(db: Session, professional: Professional, trigger: NotificationTrigger) -> NotificationRule:
    ensure_rules(db, professional)
    return db.scalar(
        select(NotificationRule).where(
            NotificationRule.professional_id == professional.id,
            NotificationRule.trigger == trigger,
        )
    )


def _ja_enviada(db: Session, booking_id: int, trigger: NotificationTrigger, destino: str) -> bool:
    """Este aviso já saiu para este destinatário?

    É o que impede o lembrete de ser repetido a cada passagem do trabalhador,
    ou o mesmo estado de ser avisado duas vezes por engano.
    """
    return db.scalar(
        select(Message.id).where(
            Message.booking_id == booking_id,
            Message.trigger == trigger,
            Message.recipient == destino,
            Message.status == MessageStatus.SENT,
        )
    ) is not None


def dispatch(
    db: Session,
    booking: Booking,
    trigger: NotificationTrigger,
    *,
    professional: Professional | None = None,
    only_client: bool = False,
    force: bool = False,
) -> list[Message]:
    """Envia o aviso deste gatilho por WhatsApp, se a regra o mandar.

    Cada destinatário recebe o seu próprio texto: o do cliente fala-lhe a ele,
    o do profissional dá-lhe os dados de que precisa para agir.

    `only_client` serve as mudanças de estado feitas à mão: quem carregou no
    botão foi o profissional, não faz sentido avisá-lo do que acabou de fazer.

    `force` salta apenas a verificação de repetição, para um reenvio pedido de
    propósito. Nunca contorna a configuração: destinatário desligado fica calado.
    """
    pro = professional or booking.professional
    if pro is None:
        return []

    regra = get_rule(db, pro, trigger)
    if regra is None or not regra.is_active:
        return []

    contexto = build_context(booking, pro)

    cliente = None
    if booking.professional_client_id:
        cliente = db.get(ProfessionalClient, booking.professional_client_id)

    # (papel, destino, ficha). O profissional cai fora quando foi ele a agir.
    alvos: list[tuple[str, str | None, ProfessionalClient | None]] = []
    if regra.to_client:
        destino = (cliente.phone if cliente else None) or booking.client_phone
        alvos.append(("client", destino, cliente))
    if regra.to_professional and not only_client:
        alvos.append(("professional", pro.whatsapp or pro.public_phone, None))

    enviadas: list[Message] = []

    for papel, destino, ficha in alvos:
        if not destino:
            continue

        corpo = render(regra.body_for(papel), contexto)
        if not corpo:
            continue
        if not force and _ja_enviada(db, booking.id, trigger, destino):
            continue

        try:
            enviadas.append(
                send_message(
                    db,
                    pro,
                    body=corpo,
                    client=ficha,
                    recipient=destino,
                    booking_id=booking.id,
                    trigger=trigger,
                )
            )
        except ValueError as erro:
            logger.info("Aviso %s não saiu: %s", trigger.value, erro)

    return enviadas



# Que gatilho corresponde a cada estado da marcação.
STATUS_TRIGGERS = {
    "pending": NotificationTrigger.BOOKING_REQUESTED,
    "confirmed": NotificationTrigger.BOOKING_CONFIRMED,
    "completed": NotificationTrigger.BOOKING_COMPLETED,
    "no_show": NotificationTrigger.BOOKING_NO_SHOW,
    "cancelled": NotificationTrigger.BOOKING_CANCELLED,
}


def trigger_for_status(status) -> NotificationTrigger | None:
    valor = status.value if hasattr(status, "value") else str(status)
    return STATUS_TRIGGERS.get(valor)


def preview(
    db: Session,
    booking: Booking,
    professional: Professional,
    trigger: NotificationTrigger,
    *,
    only_client: bool = True,
) -> dict:
    """O que sairia, sem enviar nada.

    Serve a pergunta que o painel faz antes de mudar o estado: mostrar o texto
    deixa a escolha informada, em vez de um sim/não às cegas.
    """
    regra = get_rule(db, professional, trigger)
    if regra is None or not regra.is_active:
        return {
            "will_notify": False,
            "reason": "Este aviso está desligado nas suas mensagens automáticas.",
        }

    if only_client and not regra.to_client:
        return {
            "will_notify": False,
            "reason": "Este aviso está configurado apenas para si, não para o cliente.",
        }

    destino = booking.client_phone
    if booking.professional_client_id:
        ficha = db.get(ProfessionalClient, booking.professional_client_id)
        destino = (ficha.phone if ficha else None) or destino

    if not destino:
        return {
            "will_notify": False,
            "reason": "Este cliente não tem telefone registado.",
        }

    contexto = build_context(booking, professional)
    return {
        "will_notify": True,
        "recipient_name": booking.client_name,
        "recipient": destino,
        "body": render(regra.client_body, contexto),
        "reason": None,
    }
