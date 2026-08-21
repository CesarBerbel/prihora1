"""Centro de mensagens: registo do que sai, por que canal e com que resultado."""

from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from sqlalchemy import text

from app.db.session import SessionLocal, engine
from app.models import (
    MessageChannel,
    MessageStatus,
    Professional,
    ProfessionalStatus,
    User,
    UserRole,
)
from app.services.clients import find_or_create_client
from app.services.messaging import send_message, session_row, sync_session
from app.services.whatsapp import WhatsappError


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
    """Perfil descartável.

    O envio de mensagens faz commit, por isso o rollback do fixture já não
    chega para limpar: apagamos à mão no fim. Fica PENDING de propósito, para
    que uma limpeza falhada não o deixe a aparecer nas pesquisas.
    """
    marca = datetime.now(timezone.utc).timestamp()
    user = User(
        name="Mensageira",
        email=f"msg-{marca}@teste.local",
        password_hash="x",
        role=UserRole.PROFESSIONAL,
    )
    db.add(user)
    db.flush()
    pro = Professional(
        user_id=user.id,
        slug=f"msg-{marca}",
        display_name="Estúdio Mensageiro",
        status=ProfessionalStatus.PENDING,
    )
    db.add(pro)
    db.commit()

    yield pro

    db.rollback()
    db.delete(db.get(User, user.id))
    db.commit()


@pytest.fixture
def cliente(db, profissional):
    return find_or_create_client(
        db,
        profissional.id,
        name="Beatriz Almeida",
        phone="912 345 678",
        email="beatriz@exemplo.pt",
    )


def test_usa_o_telefone_da_ficha(db, profissional, cliente):
    with patch("app.services.messaging.whatsapp_send", return_value={"id": "ABC123"}) as envio:
        m = send_message(db, profissional, body="Bom dia!", client=cliente)

    assert m.status == MessageStatus.SENT
    assert m.channel == MessageChannel.WHATSAPP
    assert m.recipient == "912 345 678"
    assert m.external_id == "ABC123"
    # A sessão é sempre a do próprio profissional.
    assert envio.call_args.args[0] == profissional.id


def test_falha_no_canal_fica_registada_em_vez_de_se_perder(db, profissional, cliente):
    with patch(
        "app.services.messaging.whatsapp_send",
        side_effect=WhatsappError("WhatsApp não está ligado."),
    ):
        m = send_message(db, profissional, body="Texto", client=cliente)

    assert m.status == MessageStatus.FAILED
    assert "não está ligado" in m.error
    assert m.sent_at is None
    # O que foi tentado continua guardado, para se saber o que aconteceu.
    assert m.id is not None
    assert m.body == "Texto"


def test_destinatario_avulso_prevalece_sobre_a_ficha(db, profissional, cliente):
    with patch("app.services.messaging.whatsapp_send", return_value={"id": "1"}):
        m = send_message(
            db, profissional, body="Texto", client=cliente, recipient="913 999 888"
        )

    assert m.recipient == "913 999 888"
    assert m.professional_client_id == cliente.id


def test_cliente_sem_telefone_e_recusado(db, profissional):
    sem_telefone = find_or_create_client(
        db, profissional.id, name="Sem Telefone", phone=None, email="x@exemplo.pt"
    )

    with pytest.raises(ValueError, match="telefone"):
        send_message(db, profissional, body="Texto", client=sem_telefone)


def test_contador_do_whatsapp_sobe_a_cada_envio(db, profissional, cliente):
    with patch("app.services.messaging.whatsapp_send", return_value={"id": "1"}):
        send_message(db, profissional, body="a", client=cliente)
        send_message(db, profissional, body="b", client=cliente)

    assert session_row(db, profissional.id).messages_sent == 2


def test_estado_da_sessao_e_copiado_do_servico(db, profissional):
    linha = sync_session(db, profissional.id, {
        "status": "connected",
        "phone_number": "912345678",
        "connected_at": "2026-08-20T10:00:00Z",
        "last_error": None,
    })

    assert linha.status == "connected"
    assert linha.phone_number == "912345678"
    assert linha.connected_at is not None


def test_ao_desligar_a_data_de_ligacao_e_esquecida(db, profissional):
    sync_session(db, profissional.id, {"status": "connected", "connected_at": "2026-08-20T10:00:00Z"})
    linha = sync_session(db, profissional.id, {"status": "disconnected"})

    assert linha.status == "disconnected"
    assert linha.connected_at is None
