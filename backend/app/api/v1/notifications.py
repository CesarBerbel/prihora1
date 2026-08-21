"""Configuração das mensagens automáticas."""

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.api.deps import CurrentProfessional, DbSession
from app.models import Booking, NotificationRule, NotificationTrigger
from app.schemas.notification import (
    RulePreview,
    RuleOut,
    RuleUpdate,
    RulesResponse,
    VariableOut,
)
from app.services.notifications import ensure_rules
from app.services.templates import (
    DEFAULTS,
    TRIGGER_LABELS,
    VARIABLES,
    build_context,
    render,
)

router = APIRouter(prefix="/me/notifications", tags=["mensagens"])

# Só os lembretes têm desvio de tempo; nos restantes o campo não faz sentido.
COM_DESVIO = {NotificationTrigger.REMINDER_BEFORE, NotificationTrigger.REMINDER_AFTER}


def _saida(regra: NotificationRule) -> RuleOut:
    item = RuleOut.model_validate(regra)
    item.label = TRIGGER_LABELS.get(regra.trigger, regra.trigger.value)
    item.uses_offset = regra.trigger in COM_DESVIO
    return item


@router.get("", response_model=RulesResponse)
def list_rules(professional: CurrentProfessional, db: DbSession) -> RulesResponse:
    """As sete regras, criando as que faltarem com os valores por omissão."""
    regras = ensure_rules(db, professional)
    db.commit()

    return RulesResponse(
        rules=[_saida(r) for r in regras],
        variables=[VariableOut(name=k, description=v) for k, v in VARIABLES.items()],
    )


@router.put("/{trigger}", response_model=RuleOut)
def update_rule(
    trigger: NotificationTrigger,
    payload: RuleUpdate,
    professional: CurrentProfessional,
    db: DbSession,
) -> RuleOut:
    ensure_rules(db, professional)
    regra = db.scalar(
        select(NotificationRule).where(
            NotificationRule.professional_id == professional.id,
            NotificationRule.trigger == trigger,
        )
    )
    if regra is None:
        raise HTTPException(status_code=404, detail="Aviso não encontrado.")

    for campo, valor in payload.model_dump().items():
        setattr(regra, campo, valor)

    db.commit()
    db.refresh(regra)
    return _saida(regra)


@router.post("/{trigger}/reset", response_model=RuleOut)
def reset_rule(
    trigger: NotificationTrigger, professional: CurrentProfessional, db: DbSession
) -> RuleOut:
    """Repõe o texto original deste aviso."""
    ensure_rules(db, professional)
    regra = db.scalar(
        select(NotificationRule).where(
            NotificationRule.professional_id == professional.id,
            NotificationRule.trigger == trigger,
        )
    )
    base = DEFAULTS[trigger]
    regra.client_body = base["client_body"]
    regra.professional_body = base["professional_body"]
    db.commit()
    db.refresh(regra)
    return _saida(regra)


@router.post("/{trigger}/preview", response_model=RulePreview)
def preview_rule(
    trigger: NotificationTrigger,
    payload: RuleUpdate,
    professional: CurrentProfessional,
    db: DbSession,
) -> RulePreview:
    """Mostra como o texto fica, com dados de uma marcação real quando existe."""
    booking = db.scalar(
        select(Booking)
        .where(Booking.professional_id == professional.id)
        .order_by(Booking.starts_at.desc())
        .limit(1)
    )

    if booking is None:
        # Sem histórico, as variáveis ficam visíveis para não enganar ninguém.
        return RulePreview(
            client_body=payload.client_body,
            professional_body=payload.professional_body,
        )

    contexto = build_context(booking, professional)
    return RulePreview(
        client_body=render(payload.client_body, contexto),
        professional_body=render(payload.professional_body, contexto),
    )
