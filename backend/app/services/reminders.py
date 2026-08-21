"""Envio dos lembretes: os únicos avisos que não nascem de uma ação.

Os outros gatilhos disparam quando alguém marca, confirma ou cancela. Estes
dependem da passagem do tempo, por isso são procurados de minuto a minuto.
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.models import (
    Booking,
    BookingStatus,
    NotificationRule,
    NotificationTrigger,
    Professional,
)
from app.services.notifications import dispatch

logger = logging.getLogger("prihora.reminders")

# Uma marcação cujo momento de aviso já passou há muito não deve ser avisada:
# só criaria confusão. Esta é a janela de tolerância.
JANELA_MINUTOS = 30

# Chave da trava do Postgres. Impede que dois processos enviem o mesmo aviso.
LOCK_ID = 918273645


def _janela(agora: datetime) -> tuple[datetime, datetime]:
    return agora - timedelta(minutes=JANELA_MINUTOS), agora


def due_reminders(db: Session, agora: datetime | None = None) -> list[tuple[Booking, NotificationTrigger]]:
    """Marcações cujo momento de lembrete caiu dentro da janela atual."""
    agora = agora or datetime.now(timezone.utc)
    inicio, fim = _janela(agora)
    pendentes: list[tuple[Booking, NotificationTrigger]] = []

    regras = db.scalars(
        select(NotificationRule).where(
            NotificationRule.trigger.in_(
                [NotificationTrigger.REMINDER_BEFORE, NotificationTrigger.REMINDER_AFTER]
            ),
            # Sem destinatário não há nada para enviar.
            (NotificationRule.to_client.is_(True))
            | (NotificationRule.to_professional.is_(True)),
        )
    ).all()

    for regra in regras:
        desvio = timedelta(minutes=regra.offset_minutes)

        if regra.trigger == NotificationTrigger.REMINDER_BEFORE:
            # Avisar X antes: a marcação começa entre agora+X-janela e agora+X.
            de, ate = inicio + desvio, fim + desvio
            estados = [BookingStatus.CONFIRMED, BookingStatus.PENDING]
            campo = Booking.starts_at
        else:
            # Seguir X depois: o atendimento acabou entre agora-X-janela e agora-X.
            de, ate = inicio - desvio, fim - desvio
            estados = [BookingStatus.COMPLETED]
            campo = Booking.ends_at

        marcacoes = db.scalars(
            select(Booking).where(
                Booking.professional_id == regra.professional_id,
                Booking.status.in_(estados),
                campo >= de,
                campo <= ate,
            )
        ).all()

        pendentes.extend((m, regra.trigger) for m in marcacoes)

    return pendentes


def run_once(db: Session) -> int:
    """Procura e envia os lembretes devidos. Devolve quantas mensagens saíram.

    A trava do Postgres garante que, com vários processos a correr, só um faz
    o trabalho de cada vez — e que nenhum fica à espera do outro.
    """
    obtida = db.scalar(text(f"SELECT pg_try_advisory_lock({LOCK_ID})"))
    # A trava é da sessão, não da transação: sobrevive a um rollback. Fechar a
    # transação aqui deixa-a limpa para o trabalho que vem a seguir.
    db.commit()
    if not obtida:
        return 0

    try:
        enviadas = 0
        for booking, gatilho in due_reminders(db):
            profissional = db.get(Professional, booking.professional_id)
            if profissional is None:
                continue
            enviadas += len(dispatch(db, booking, gatilho, professional=profissional))

        if enviadas:
            logger.info("Lembretes enviados: %s", enviadas)
        return enviadas
    finally:
        # Sem o rollback, uma transação já abortada faria o unlock rebentar —
        # e esse erro substituiria o original, escondendo a verdadeira causa.
        db.rollback()
        db.execute(text(f"SELECT pg_advisory_unlock({LOCK_ID})"))
        db.commit()
