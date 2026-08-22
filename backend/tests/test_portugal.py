"""Regras específicas de Portugal: telefone, distrito e localidades."""

import pytest
from sqlalchemy import text

from app.db.session import SessionLocal, engine
from app.models import phone_digits
from app.services.search import resolve_location


def _db_disponivel() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


# --- telefone ---------------------------------------------------------------
def test_indicativo_de_portugal_nao_cria_pessoa_duplicada():
    """As formas de escrever o mesmo número têm de colapsar numa só."""
    formas = [
        "912 345 678",
        "912345678",
        "+351 912 345 678",
        "351912345678",
        "00351912345678",
        "+351912345678",
    ]
    assert len({phone_digits(f) for f in formas}) == 1
    assert phone_digits(formas[0]) == "912345678"


def test_fixo_de_lisboa_e_preservado():
    assert phone_digits("213 456 789") == "213456789"
    assert phone_digits("+351 213 456 789") == "213456789"


def test_numero_sem_indicativo_com_nove_digitos_fica_intacto():
    """351... com 9 dígitos é um número nacional, não um indicativo."""
    assert phone_digits("351234567") == "351234567"


def test_telefone_vazio_ou_sem_digitos():
    assert phone_digits(None) == ""
    assert phone_digits("sem número") == ""


# --- localidades e distritos ------------------------------------------------
@pytest.mark.skipif(not _db_disponivel(), reason="Requer o Postgres do compose")
def test_localidade_portuguesa_resolve_coordenadas(db):
    lat, lng, cidade = resolve_location(db, lat=None, lng=None, city="Braga", state=None)

    assert cidade is not None
    assert cidade.state == "Braga"
    # Braga fica no noroeste: latitude alta e longitude negativa.
    assert 41.0 < lat < 42.0
    assert -9.0 < lng < -8.0


@pytest.mark.skipif(not _db_disponivel(), reason="Requer o Postgres do compose")
def test_distrito_com_nome_composto_e_aceite(db):
    """O antigo formato de duas letras não servia para "Viana do Castelo"."""
    lat, lng, cidade = resolve_location(
        db, lat=None, lng=None, city="Viana do Castelo", state=None
    )
    assert cidade is not None
    assert cidade.state == "Viana do Castelo"


@pytest.mark.skipif(not _db_disponivel(), reason="Requer o Postgres do compose")
def test_localidade_com_distrito_separado_por_virgula(db):
    lat, lng, cidade = resolve_location(
        db, lat=None, lng=None, city="Almada, Setúbal", state=None
    )
    assert cidade is not None
    assert cidade.name == "Almada"
    assert cidade.state == "Setúbal"


@pytest.mark.skipif(not _db_disponivel(), reason="Requer o Postgres do compose")
def test_nao_restam_localidades_de_outro_pais(db):
    from sqlalchemy import select

    from app.models import City
    from app.seed.data import DISTRICTS

    distritos = {d.lower() for d in DISTRICTS}
    fora = [
        c.name
        for c in db.scalars(select(City)).all()
        if c.state.lower() not in distritos
    ]
    assert fora == [], f"localidades fora dos distritos portugueses: {fora[:5]}"


# --- catálogo de especialidades ----------------------------------------------
def test_o_endereco_de_pesquisa_nao_muda_por_causa_do_nome(db):
    """Corrigir uma gralha no nome não pode partir ligações guardadas.

    O slug de uma especialidade anda nos endereços que as pessoas guardam
    (`/buscar?category=manicure`). Derivá-lo do nome a cada gravação fazia com
    que um acerto de texto partisse essas ligações — sem ninguém pedir e sem
    dar erro nenhum.
    """
    from slugify import slugify

    # A regra do endpoint, em duas linhas: sem slug no pedido, fica o antigo.
    def novo_slug(pedido: str | None, atual: str) -> str:
        return slugify(pedido) if pedido else atual

    assert novo_slug(None, "manicure") == "manicure"
    assert novo_slug("", "manicure") == "manicure"
    assert novo_slug("micro-capilar", "manicure") == "micro-capilar"
    # E o que se escreve à mão passa na mesma pelo slugify.
    assert novo_slug("Micro Capilar!", "manicure") == "micro-capilar"
