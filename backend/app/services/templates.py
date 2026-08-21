"""Modelos de texto das mensagens automáticas e as variáveis do sistema."""

from datetime import datetime
from zoneinfo import ZoneInfo

from app.models import Booking, NotificationTrigger, Professional

# Variáveis que o profissional pode usar nos modelos. A lista é fechada de
# propósito: assim a interface consegue mostrá-las e validar o que foi escrito.
VARIABLES: dict[str, str] = {
    "cliente": "Nome do cliente",
    "profissional": "O seu nome público",
    "servico": "Nome do serviço",
    "data": "Data do atendimento (20/08/2026)",
    "hora": "Hora do atendimento (14:30)",
    "dia_semana": "Dia da semana (quinta-feira)",
    "duracao": "Duração em minutos",
    "preco": "Preço formatado (25,00 €)",
    "codigo": "Código de acompanhamento da marcação",
    "morada": "Onde decorre o atendimento",
    "telefone": "O seu telefone de contacto",
    "telefone_cliente": "Telefone do cliente (útil nos avisos para si)",
    "motivo": "Motivo do cancelamento, quando houver",
}

DIAS = [
    "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira",
    "sexta-feira", "sábado", "domingo",
]


def build_context(booking: Booking, professional: Professional) -> dict[str, str]:
    """Valores das variáveis para uma marcação concreta."""
    try:
        fuso = ZoneInfo(professional.timezone or "Europe/Lisbon")
    except Exception:
        fuso = ZoneInfo("Europe/Lisbon")

    quando: datetime = booking.starts_at.astimezone(fuso)
    morada = booking.address_line or professional.address_line or ""
    if not morada and professional.city:
        morada = professional.city

    return {
        "cliente": booking.client_name or "",
        "profissional": professional.display_name or "",
        "servico": booking.service_name or "",
        "data": quando.strftime("%d/%m/%Y"),
        "hora": quando.strftime("%H:%M"),
        "dia_semana": DIAS[quando.weekday()],
        "duracao": str(int((booking.ends_at - booking.starts_at).total_seconds() // 60)),
        "preco": f"{booking.price_cents / 100:.2f}".replace(".", ",") + " €",
        "codigo": booking.code or "",
        "morada": morada,
        "telefone": professional.public_phone or professional.whatsapp or "",
        "telefone_cliente": booking.client_phone or "",
        "motivo": booking.cancel_reason or "",
    }


def render(modelo: str, contexto: dict[str, str]) -> str:
    """Substitui {variavel} pelos valores.

    Não usa str.format: um `{` solto no texto rebentaria o envio. Aqui, o que
    não for uma variável conhecida fica tal e qual, visível para quem escreveu.
    """
    saida = modelo
    for chave, valor in contexto.items():
        saida = saida.replace("{" + chave + "}", valor)
    return saida.strip()



# Valores por omissão de cada gatilho.
#
# São dois textos por gatilho, porque as duas pontas precisam de coisas
# diferentes: o cliente quer saber o que lhe vai acontecer; o profissional quer
# saber quem, quando e como contactar. Repetir a mesma frase para os dois
# obrigaria a escrever uma que não serve bem a nenhum.
DEFAULTS: dict[NotificationTrigger, dict] = {
    NotificationTrigger.BOOKING_REQUESTED: {
        "to_client": True,
        "to_professional": True,
        "offset_minutes": 0,
        "client_body": (
            "Olá {cliente}, recebemos o seu pedido de marcação:\n"
            "{servico}, {dia_semana}, {data} às {hora}.\n\n"
            "Confirmo em breve. O código da marcação é {codigo}.\n\n"
            "{profissional}"
        ),
        "professional_body": (
            "Nova marcação pedida.\n\n"
            "{cliente} — {telefone_cliente}\n"
            "{servico} · {duracao} min · {preco}\n"
            "{dia_semana}, {data} às {hora}\n\n"
            "Código {codigo}. Confirme pelo painel."
        ),
    },
    NotificationTrigger.BOOKING_CONFIRMED: {
        "to_client": True,
        "to_professional": False,
        "offset_minutes": 0,
        "client_body": (
            "Olá {cliente}, a sua marcação está confirmada:\n"
            "{servico}, {dia_semana}, {data} às {hora}.\n"
            "Local: {morada}\n"
            "Valor: {preco}\n\n"
            "Se precisar de alterar alguma coisa, é só dizer.\n\n"
            "{profissional}"
        ),
        "professional_body": (
            "Marcação confirmada: {cliente} — {servico}, {data} às {hora}."
        ),
    },
    NotificationTrigger.BOOKING_COMPLETED: {
        "to_client": True,
        "to_professional": False,
        "offset_minutes": 0,
        "client_body": (
            "Olá {cliente}, obrigada por ter vindo. Espero que tenha gostado do resultado.\n\n"
            "Se quiser deixar a sua avaliação, use o código {codigo}.\n\n"
            "Até à próxima,\n{profissional}"
        ),
        "professional_body": (
            "Atendimento concluído: {cliente} — {servico}, {data} às {hora}. {preco}"
        ),
    },
    NotificationTrigger.BOOKING_NO_SHOW: {
        "to_client": False,
        "to_professional": False,
        "offset_minutes": 0,
        "client_body": (
            "Olá {cliente}, fiquei à sua espera {data} às {hora} para {servico}.\n\n"
            "Se quiser remarcar, é só responder a esta mensagem.\n\n"
            "{profissional}"
        ),
        "professional_body": (
            "Falta: {cliente} — {telefone_cliente} não compareceu a {data} às {hora}."
        ),
    },
    NotificationTrigger.BOOKING_CANCELLED: {
        "to_client": True,
        "to_professional": True,
        "offset_minutes": 0,
        "client_body": (
            "Olá {cliente}, a marcação de {servico}, {data} às {hora}, foi cancelada.\n"
            "{motivo}\n\n"
            "Se quiser remarcar, diga-me e vemos uma nova hora.\n\n"
            "{profissional}"
        ),
        "professional_body": (
            "Marcação cancelada.\n\n"
            "{cliente} — {telefone_cliente}\n"
            "{servico}, {data} às {hora}\n"
            "{motivo}\n\n"
            "A hora ficou livre na sua agenda."
        ),
    },
    NotificationTrigger.REMINDER_BEFORE: {
        "to_client": True,
        "to_professional": False,
        "offset_minutes": 120,
        "client_body": (
            "Olá {cliente}, passo só a lembrar: {servico} hoje às {hora}.\n"
            "Local: {morada}\n\n"
            "Até já,\n{profissional}"
        ),
        "professional_body": (
            "A seguir: {cliente} — {telefone_cliente}, {servico} às {hora}."
        ),
    },
    NotificationTrigger.REMINDER_AFTER: {
        "to_client": False,
        "to_professional": False,
        "offset_minutes": 1440,
        "client_body": (
            "Olá {cliente}, como está a correr?\n\n"
            "Qualquer dúvida sobre os cuidados, é só dizer.\n\n"
            "{profissional}"
        ),
        "professional_body": (
            "Seguimento de {cliente} — {servico} de {data}. Vale a pena perguntar como correu."
        ),
    },
}

# Como cada gatilho se chama na interface.
TRIGGER_LABELS: dict[NotificationTrigger, str] = {
    NotificationTrigger.BOOKING_REQUESTED: "Pedido de marcação",
    NotificationTrigger.BOOKING_CONFIRMED: "Marcação confirmada",
    NotificationTrigger.BOOKING_COMPLETED: "Atendimento concluído",
    NotificationTrigger.BOOKING_NO_SHOW: "Não compareceu",
    NotificationTrigger.BOOKING_CANCELLED: "Marcação cancelada",
    NotificationTrigger.REMINDER_BEFORE: "Lembrete antes do atendimento",
    NotificationTrigger.REMINDER_AFTER: "Seguimento depois do atendimento",
}
