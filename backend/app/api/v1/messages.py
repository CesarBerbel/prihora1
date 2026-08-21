"""Centro de mensagens do profissional: WhatsApp próprio e e-mail do site."""

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.api.deps import CurrentProfessional, DbSession
from app.models import Message, ProfessionalClient
from app.schemas.common import Message as MessageOutText
from app.schemas.common import Page
from app.schemas.message import ChannelsStatus, MessageCreate, MessageOut, WhatsappStatus
from app.services import whatsapp as wa
from app.services.messaging import send_message, session_row, sync_session
from app.services.whatsapp import WhatsappError
from app.core.config import settings

router = APIRouter(prefix="/me/messages", tags=["mensagens"])


def _estado_whatsapp(db: DbSession, professional_id: int, estado: dict) -> WhatsappStatus:
    linha = sync_session(db, professional_id, estado)
    db.commit()
    return WhatsappStatus(
        status=linha.status,
        qr=estado.get("qr"),
        phone_number=linha.phone_number,
        connected_at=linha.connected_at,
        last_error=linha.last_error,
        messages_sent=linha.messages_sent,
        enabled=settings.WHATSAPP_ENABLED,
    )


@router.get("/channels", response_model=ChannelsStatus)
def channels(professional: CurrentProfessional, db: DbSession) -> ChannelsStatus:
    """Como estão os dois canais. Nunca falha: a página tem de abrir na mesma."""
    return ChannelsStatus(
        whatsapp=_estado_whatsapp(db, professional.id, wa.status(professional.id))
    )


@router.post("/whatsapp/connect", response_model=WhatsappStatus)
def whatsapp_connect(professional: CurrentProfessional, db: DbSession) -> WhatsappStatus:
    """Abre a sessão e devolve o código para ler com o telemóvel.

    Cada profissional liga a sua própria conta: o serviço guarda as credenciais
    numa pasta por sessão e o identificador vem daqui, nunca do pedido.
    """
    try:
        estado = wa.connect(professional.id)
    except WhatsappError as erro:
        raise HTTPException(status_code=503, detail=str(erro))
    return _estado_whatsapp(db, professional.id, estado)


@router.delete("/whatsapp", response_model=WhatsappStatus)
def whatsapp_disconnect(professional: CurrentProfessional, db: DbSession) -> WhatsappStatus:
    """Termina a sessão e apaga as credenciais guardadas."""
    try:
        wa.disconnect(professional.id)
    except WhatsappError as erro:
        raise HTTPException(status_code=503, detail=str(erro))

    linha = session_row(db, professional.id)
    linha.status = "disconnected"
    linha.phone_number = None
    linha.connected_at = None
    linha.last_error = None
    db.commit()

    return WhatsappStatus(
        status="disconnected", messages_sent=linha.messages_sent,
        enabled=settings.WHATSAPP_ENABLED,
    )


@router.get("", response_model=Page[MessageOut])
def list_messages(
    professional: CurrentProfessional,
    db: DbSession,
    client_id: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
) -> Page[MessageOut]:
    query = select(Message).where(Message.professional_id == professional.id)
    if client_id:
        query = query.where(Message.professional_client_id == client_id)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    linhas = db.scalars(
        query.order_by(Message.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    ).all()

    return Page[MessageOut](
        items=[MessageOut.model_validate(m) for m in linhas],
        total=total,
        page=page,
        per_page=per_page,
        pages=max((total + per_page - 1) // per_page, 1),
    )


@router.post("", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def create_message(
    payload: MessageCreate, professional: CurrentProfessional, db: DbSession
) -> MessageOut:
    """Envia uma mensagem por um dos canais e guarda o resultado.

    Uma falha no canal não devolve erro: a mensagem fica registada como
    falhada, com o motivo, para não se perder o rasto do que foi tentado.
    """
    cliente = None
    if payload.client_id is not None:
        cliente = db.get(ProfessionalClient, payload.client_id)
        if not cliente or cliente.professional_id != professional.id:
            raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    try:
        mensagem = send_message(
            db,
            professional,
            body=payload.body,
            client=cliente,
            recipient=payload.recipient,
            booking_id=payload.booking_id,
        )
    except ValueError as erro:
        raise HTTPException(status_code=400, detail=str(erro))

    return MessageOut.model_validate(mensagem)


@router.delete("/{message_id}", response_model=MessageOutText)
def delete_message(
    message_id: int, professional: CurrentProfessional, db: DbSession
) -> MessageOutText:
    """Remove uma entrada do histórico. Não recolhe o que já foi enviado."""
    mensagem = db.get(Message, message_id)
    if not mensagem or mensagem.professional_id != professional.id:
        raise HTTPException(status_code=404, detail="Mensagem não encontrada.")

    db.delete(mensagem)
    db.commit()
    return MessageOutText(detail="Mensagem removida do histórico.")
