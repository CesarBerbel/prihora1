"""Cadastro de clientes por profissional."""

from datetime import datetime, timezone

import pytest
from sqlalchemy import text

from app.db.session import SessionLocal, engine
from app.models import Professional, ProfessionalStatus, User, UserRole, phone_digits
from app.services.clients import find_client, find_or_create_client


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


def _novo_profissional(db, sufixo: str) -> Professional:
    marca = f"{datetime.now(timezone.utc).timestamp()}-{sufixo}"
    user = User(
        name=f"Pro {sufixo}",
        email=f"pro-{marca}@teste.local",
        password_hash="x",
        role=UserRole.PROFESSIONAL,
    )
    db.add(user)
    db.flush()
    pro = Professional(
        user_id=user.id,
        slug=f"pro-{marca}",
        display_name=f"Pro {sufixo}",
        status=ProfessionalStatus.ACTIVE,
    )
    db.add(pro)
    db.flush()
    return pro


@pytest.fixture
def pro(db):
    return _novo_profissional(db, "a")


def test_normalizacao_do_telefone():
    assert phone_digits("(11) 98888-7777") == "11988887777"
    assert phone_digits("11988887777") == "11988887777"
    assert phone_digits("+55 11 98888 7777") == "5511988887777"
    assert phone_digits(None) == ""
    assert phone_digits("sem numero") == ""


def test_cria_ficha_quando_nao_existe(db, pro):
    client = find_or_create_client(
        db, pro.id, name="Beatriz Almeida", phone="(11) 91111-2222"
    )

    assert client.id is not None
    assert client.name == "Beatriz Almeida"
    assert client.phone_digits == "11911112222"


def test_mesmo_telefone_escrito_diferente_reaproveita_a_ficha(db, pro):
    primeiro = find_or_create_client(db, pro.id, name="Camila", phone="(11) 93333-4444")
    segundo = find_or_create_client(db, pro.id, name="Camila R.", phone="11933334444")

    assert primeiro.id == segundo.id, "nao pode duplicar a ficha"
    # O nome digitado pelo profissional prevalece sobre o do formulario publico.
    assert segundo.name == "Camila"


def test_ficha_e_privada_de_cada_profissional(db, pro):
    outro = _novo_profissional(db, "b")

    da_ana = find_or_create_client(db, pro.id, name="Renata", phone="(11) 95555-6666")
    do_outro = find_or_create_client(db, outro.id, name="Renata", phone="(11) 95555-6666")

    assert da_ana.id != do_outro.id, "o mesmo telefone rende fichas separadas por profissional"
    assert find_client(db, pro.id, phone="(11) 95555-6666").id == da_ana.id
    assert find_client(db, outro.id, phone="(11) 95555-6666").id == do_outro.id


def test_completa_o_que_faltava_sem_apagar_o_que_ja_havia(db, pro):
    client = find_or_create_client(db, pro.id, name="Paula", phone="(11) 96666-7777")
    client.notes = "Prefere horario da manha"
    db.flush()

    de_novo = find_or_create_client(
        db, pro.id, name="Paula Andrade", phone="(11) 96666-7777", email="paula@exemplo.com"
    )

    assert de_novo.id == client.id
    assert de_novo.email == "paula@exemplo.com", "deve preencher o e-mail que faltava"
    assert de_novo.notes == "Prefere horario da manha", "nao pode apagar a anotacao"


def test_ficha_arquivada_volta_a_ativa_ao_agendar_de_novo(db, pro):
    client = find_or_create_client(db, pro.id, name="Larissa", phone="(11) 97777-8888")
    client.is_active = False
    db.flush()

    de_volta = find_or_create_client(db, pro.id, name="Larissa", phone="(11) 97777-8888")
    assert de_volta.id == client.id
    assert de_volta.is_active is True


def test_busca_por_email_quando_nao_ha_telefone(db, pro):
    find_or_create_client(db, pro.id, name="Sem Telefone", phone=None, email="x@exemplo.com")

    achado = find_client(db, pro.id, phone=None, email="X@Exemplo.com")
    assert achado is not None
    assert achado.name == "Sem Telefone"


def test_sem_telefone_nem_email_sempre_cria_ficha_nova(db, pro):
    """Sem chave de contato nao da para saber se e a mesma pessoa."""
    a = find_or_create_client(db, pro.id, name="Anonimo", phone=None)
    b = find_or_create_client(db, pro.id, name="Anonimo", phone=None)

    assert a.id != b.id
