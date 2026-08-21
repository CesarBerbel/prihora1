"""Gatilhos das mensagens automáticas."""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from sqlalchemy import text

from app.db.session import SessionLocal, engine
from app.models import (
    Booking,
    BookingStatus,
    MessageChannel,
    NotificationTrigger,
    Professional,
    ProfessionalStatus,
    User,
    UserRole,
)
from app.services.clients import find_or_create_client
from app.services.notifications import dispatch, ensure_rules, get_rule, preview, trigger_for_status
from app.services.reminders import due_reminders
from app.services.templates import DEFAULTS, build_context, render


def _db_disponivel() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _db_disponivel(), reason="Requer o Postgres do compose (use: make test)"
)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def profissional(db):
    marca = datetime.now(timezone.utc).timestamp()
    user = User(
        name="Avisadora", email=f"avisos-{marca}@teste.local",
        password_hash="x", role=UserRole.PROFESSIONAL,
    )
    db.add(user)
    db.flush()
    pro = Professional(
        user_id=user.id, slug=f"avisos-{marca}", display_name="Estúdio Aviso",
        status=ProfessionalStatus.PENDING, city="Braga", address_line="Rua Teste, 1",
        public_phone="912 000 000", timezone="Europe/Lisbon",
    )
    db.add(pro)
    db.commit()

    yield pro

    db.rollback()
    db.delete(db.get(User, user.id))
    db.commit()


@pytest.fixture
def marcacao(db, profissional):
    ficha = find_or_create_client(
        db, profissional.id, name="Rita Cliente",
        phone="913 111 222", email="rita@exemplo.pt",
    )
    inicio = datetime.now(timezone.utc) + timedelta(days=1)
    b = Booking(
        code="PHTESTE1", professional_id=profissional.id,
        professional_client_id=ficha.id,
        client_name="Rita Cliente", client_phone="913 111 222",
        client_email="rita@exemplo.pt",
        starts_at=inicio, ends_at=inicio + timedelta(minutes=45),
        status=BookingStatus.PENDING, service_name="Manicure", price_cents=1400,
    )
    db.add(b)
    db.commit()
    return b


def test_todos_os_gatilhos_nascem_com_dois_textos(db, profissional):
    regras = ensure_rules(db, profissional)
    db.commit()

    assert len(regras) == len(DEFAULTS)
    for regra in regras:
        assert regra.client_body.strip(), f"{regra.trigger} sem texto do cliente"
        assert regra.professional_body.strip(), f"{regra.trigger} sem texto do profissional"
        # Um modelo sem variáveis seria igual para toda a gente.
        assert "{" in regra.client_body
        assert "{" in regra.professional_body


def test_os_dois_textos_sao_mesmo_diferentes(db, profissional):
    """A razão de existirem dois: dizem coisas diferentes a cada lado."""
    for regra in ensure_rules(db, profissional):
        assert regra.client_body != regra.professional_body, (
            f"{regra.trigger}: os dois destinatários receberiam a mesma frase"
        )
    db.commit()


def test_o_texto_do_profissional_traz_o_contacto_do_cliente(db, profissional):
    """Serve para agir: sem o telefone do cliente, obrigava a ir ao painel."""
    regras = {r.trigger: r for r in ensure_rules(db, profissional)}
    db.commit()

    for gatilho in (
        NotificationTrigger.BOOKING_REQUESTED,
        NotificationTrigger.BOOKING_CANCELLED,
        NotificationTrigger.REMINDER_BEFORE,
    ):
        assert "{telefone_cliente}" in regras[gatilho].professional_body


def test_criar_regras_e_idempotente(db, profissional):
    primeira = ensure_rules(db, profissional)
    db.commit()
    segunda = ensure_rules(db, profissional)
    db.commit()

    assert [r.id for r in primeira] == [r.id for r in segunda]


def test_cada_estado_tem_o_seu_gatilho(db):
    assert trigger_for_status(BookingStatus.CONFIRMED) == NotificationTrigger.BOOKING_CONFIRMED
    assert trigger_for_status(BookingStatus.COMPLETED) == NotificationTrigger.BOOKING_COMPLETED
    assert trigger_for_status(BookingStatus.NO_SHOW) == NotificationTrigger.BOOKING_NO_SHOW
    assert trigger_for_status(BookingStatus.CANCELLED) == NotificationTrigger.BOOKING_CANCELLED


def test_sem_destinatarios_nao_envia_nada(db, profissional, marcacao):
    regra = get_rule(db, profissional, NotificationTrigger.BOOKING_CONFIRMED)
    regra.to_client = False
    regra.to_professional = False
    db.commit()

    with patch("app.services.messaging.whatsapp_send") as envio:
        saidas = dispatch(db, marcacao, NotificationTrigger.BOOKING_CONFIRMED,
                          professional=profissional)

    assert saidas == []
    envio.assert_not_called()


def test_cada_destinatario_recebe_o_seu_texto(db, profissional, marcacao):
    regra = get_rule(db, profissional, NotificationTrigger.BOOKING_REQUESTED)
    regra.to_client = True
    regra.to_professional = True
    regra.client_body = "Olá {cliente}, recebemos o seu pedido."
    regra.professional_body = "Nova marcação de {cliente}, {telefone_cliente}."
    db.commit()
    profissional.whatsapp = "919 000 000"
    db.commit()

    with patch("app.services.messaging.whatsapp_send", return_value={"id": "1"}):
        saidas = dispatch(db, marcacao, NotificationTrigger.BOOKING_REQUESTED,
                          professional=profissional)

    textos = {m.recipient: m.body for m in saidas}
    assert textos["913 111 222"].startswith("Olá Rita Cliente")
    assert textos["919 000 000"].startswith("Nova marcação de Rita Cliente")
    assert "913 111 222" in textos["919 000 000"], "o aviso ao profissional traz o contacto"


def test_tudo_sai_por_whatsapp(db, profissional, marcacao):
    regra = get_rule(db, profissional, NotificationTrigger.BOOKING_CONFIRMED)
    regra.to_client = True
    db.commit()

    with patch("app.services.messaging.whatsapp_send", return_value={"id": "1"}):
        saidas = dispatch(db, marcacao, NotificationTrigger.BOOKING_CONFIRMED,
                          professional=profissional)

    assert {m.channel for m in saidas} == {MessageChannel.WHATSAPP}


def test_mudanca_de_estado_avisa_so_o_cliente(db, profissional, marcacao):
    """A regra manda avisar os dois, mas quem carregou no botão foi o profissional."""
    regra = get_rule(db, profissional, NotificationTrigger.BOOKING_CANCELLED)
    regra.to_client = True
    regra.to_professional = True
    db.commit()

    with patch("app.services.messaging.whatsapp_send", return_value={"id": "1"}):
        saidas = dispatch(
            db, marcacao, NotificationTrigger.BOOKING_CANCELLED,
            professional=profissional, only_client=True,
        )

    destinos = {m.recipient for m in saidas}
    assert destinos == {"913 111 222"}


def test_sem_only_client_o_profissional_tambem_recebe(db, profissional, marcacao):
    regra = get_rule(db, profissional, NotificationTrigger.BOOKING_CANCELLED)
    regra.to_client = True
    regra.to_professional = True
    db.commit()

    with patch("app.services.messaging.whatsapp_send", return_value={"id": "1"}):
        saidas = dispatch(db, marcacao, NotificationTrigger.BOOKING_CANCELLED,
                          professional=profissional)

    destinos = {m.recipient for m in saidas}
    assert "913 111 222" in destinos, "o cliente"
    assert "912 000 000" in destinos, "o profissional, pelo telefone público"


def test_o_mesmo_aviso_nao_sai_duas_vezes(db, profissional, marcacao):
    regra = get_rule(db, profissional, NotificationTrigger.BOOKING_CONFIRMED)
    regra.to_client = True
    regra.to_professional = False
    db.commit()

    with patch("app.services.messaging.whatsapp_send", return_value={"id": "1"}):
        primeira = dispatch(db, marcacao, NotificationTrigger.BOOKING_CONFIRMED,
                            professional=profissional)
        segunda = dispatch(db, marcacao, NotificationTrigger.BOOKING_CONFIRMED,
                           professional=profissional)

    assert len(primeira) == 1
    assert segunda == [], "o segundo despacho devia ter sido travado"


def test_reenvio_pedido_de_proposito_passa(db, profissional, marcacao):
    regra = get_rule(db, profissional, NotificationTrigger.BOOKING_CONFIRMED)
    db.commit()

    with patch("app.services.messaging.whatsapp_send", return_value={"id": "1"}):
        dispatch(db, marcacao, NotificationTrigger.BOOKING_CONFIRMED, professional=profissional)
        forcado = dispatch(db, marcacao, NotificationTrigger.BOOKING_CONFIRMED,
                           professional=profissional, force=True)

    assert len(forcado) == 1


def test_o_texto_sai_com_as_variaveis_preenchidas(db, profissional, marcacao):
    contexto = build_context(marcacao, profissional)
    saida = render("Olá {cliente}, {servico} a {data} às {hora} por {preco}.", contexto)

    assert "Rita Cliente" in saida
    assert "Manicure" in saida
    assert "14,00 €" in saida
    assert "{" not in saida, f"ficou variável por substituir: {saida}"


def test_chaveta_solta_no_texto_nao_rebenta(db, profissional, marcacao):
    """Um { escrito à mão não pode impedir o envio."""
    contexto = build_context(marcacao, profissional)
    saida = render("Desconto de 50% { só hoje } para {cliente}", contexto)

    assert "Rita Cliente" in saida
    assert "só hoje" in saida


def test_previsao_mostra_o_texto_sem_enviar(db, profissional, marcacao):
    regra = get_rule(db, profissional, NotificationTrigger.BOOKING_CONFIRMED)
    regra.to_client = True
    db.commit()

    with patch("app.services.messaging.whatsapp_send", return_value={"id": "1"}) as envio:
        resultado = preview(db, marcacao, profissional, NotificationTrigger.BOOKING_CONFIRMED)

    assert resultado["will_notify"] is True
    assert "Rita Cliente" in resultado["body"]
    envio.assert_not_called()


def test_previsao_explica_quando_nada_vai_sair(db, profissional, marcacao):
    regra = get_rule(db, profissional, NotificationTrigger.BOOKING_NO_SHOW)
    regra.to_client = False
    regra.to_professional = False
    db.commit()

    resultado = preview(db, marcacao, profissional, NotificationTrigger.BOOKING_NO_SHOW)

    assert resultado["will_notify"] is False
    assert "desligado" in resultado["reason"]


def test_previsao_avisa_quando_a_regra_e_so_para_o_profissional(db, profissional, marcacao):
    regra = get_rule(db, profissional, NotificationTrigger.BOOKING_COMPLETED)
    regra.to_client = False
    regra.to_professional = True
    db.commit()

    resultado = preview(db, marcacao, profissional, NotificationTrigger.BOOKING_COMPLETED)

    assert resultado["will_notify"] is False
    assert "apenas para si" in resultado["reason"]
