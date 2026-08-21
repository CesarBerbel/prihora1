"""Ponte para o serviço de WhatsApp.

O Baileys é uma biblioteca de Node, por isso vive num serviço à parte. Este
módulo é a única porta de entrada: o frontend nunca fala com ele diretamente,
o que mantém a autorização — quem pode mexer em que sessão — deste lado, onde
as contas são conhecidas.
"""

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger("prihora.whatsapp")

TIMEOUT = httpx.Timeout(30.0, connect=5.0)


class WhatsappError(Exception):
    """Falha na ligação ou no envio, com mensagem para quem está a usar."""


def _pedido(metodo: str, caminho: str, **kwargs) -> dict:
    if not settings.WHATSAPP_ENABLED:
        raise WhatsappError("O WhatsApp está desligado nesta instalação.")

    url = settings.WHATSAPP_URL.rstrip("/") + caminho
    cabecalhos = {"X-Service-Token": settings.WHATSAPP_TOKEN}

    try:
        with httpx.Client(timeout=TIMEOUT) as cliente:
            resposta = cliente.request(metodo, url, headers=cabecalhos, **kwargs)
    except httpx.HTTPError as erro:
        logger.warning("Serviço de WhatsApp indisponível: %s", erro)
        raise WhatsappError(
            "O serviço de WhatsApp não respondeu. Tente novamente dentro de instantes."
        ) from erro

    if resposta.status_code >= 400:
        detalhe = "Erro no serviço de WhatsApp."
        try:
            detalhe = resposta.json().get("detail", detalhe)
        except ValueError:
            pass
        raise WhatsappError(detalhe)

    return resposta.json()


def status(professional_id: int) -> dict:
    """Estado da sessão. Nunca levanta erro: a interface tem de abrir na mesma."""
    try:
        return _pedido("GET", f"/sessions/{professional_id}")
    except WhatsappError as erro:
        return {
            "id": str(professional_id),
            "status": "unavailable",
            "qr": None,
            "phone_number": None,
            "connected_at": None,
            "last_error": str(erro),
        }


def connect(professional_id: int) -> dict:
    """Abre a sessão. Devolve o QR quando ainda não há credenciais guardadas."""
    return _pedido("POST", f"/sessions/{professional_id}/connect")


def disconnect(professional_id: int) -> dict:
    return _pedido("DELETE", f"/sessions/{professional_id}")


def send(professional_id: int, to: str, text: str) -> dict:
    return _pedido(
        "POST", f"/sessions/{professional_id}/messages", json={"to": to, "text": text}
    )
