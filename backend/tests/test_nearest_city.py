"""A localidade mais próxima de umas coordenadas.

É ela que preenche o campo "Localidade ou freguesia" quando um visitante
carrega em "usar a minha localização". Como o visitante não tem sessão
iniciada, esta resposta não pode depender do serviço externo de geocodificação
— sai da nossa própria tabela de localidades, e é isso que estes testes fixam.
"""

import pytest
from sqlalchemy import text

from app.db.session import SessionLocal, engine
from app.services.geocoding import cidade_mais_perto
from app.services.search import resolve_location


def _db_disponivel() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _db_disponivel(), reason="sem base de dados")


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


# Coordenadas reais de cada sítio e a localidade que se espera de volta.
LUGARES = [
    ((38.7223, -9.1393), "Lisboa"),
    ((41.1579, -8.6291), "Porto"),
    ((37.0194, -7.9304), "Faro"),
    ((38.6790, -9.1569), "Almada"),
]


@pytest.mark.parametrize("coords,esperada", LUGARES)
def test_devolve_a_localidade_de_quem_esta_la(db, coords, esperada):
    cidade = cidade_mais_perto(db, *coords)
    assert cidade is not None
    assert cidade.name == esperada


def test_longe_de_tudo_devolve_nada_em_vez_de_inventar(db):
    """No meio do Atlântico não há localidade nossa: melhor nada do que errado."""
    assert cidade_mais_perto(db, 30.0, -40.0) is None


def test_um_pouco_ao_lado_ainda_acerta(db):
    """Uns quilómetros de imprecisão do GPS não podem trocar a localidade."""
    cidade = cidade_mais_perto(db, 38.7223 + 0.02, -9.1393 - 0.02)
    assert cidade is not None
    assert cidade.name == "Lisboa"


@pytest.mark.parametrize("coords,esperada", LUGARES)
def test_o_nome_devolvido_volta_a_ser_reconhecido_pela_pesquisa(db, coords, esperada):
    """O nome vai parar ao campo de pesquisa, logo tem de dar a volta completa.

    Quem carrega em "usar a minha localização" fica com o nome escrito no
    campo; se carregar em "Procurar" outra vez — já sem a localização do
    dispositivo — a pesquisa tem de chegar à mesma localidade.
    """
    cidade = cidade_mais_perto(db, *coords)
    assert cidade is not None

    # O rótulo que o campo mostra: "Almada, Setúbal", ou só "Lisboa" quando a
    # localidade dá nome ao próprio distrito.
    rotulo = cidade.name if cidade.state == cidade.name else f"{cidade.name}, {cidade.state}"

    _, _, encontrada = resolve_location(db, lat=None, lng=None, city=rotulo, state=None)
    assert encontrada is not None
    assert encontrada.id == cidade.id
    assert encontrada.name == esperada
