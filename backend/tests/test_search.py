"""Testes da busca, com foco na ampliacao automatica.

Rodam contra o Postgres do compose, sobre os dados de demonstracao (make test).
"""

import pytest
from sqlalchemy import text

from app.db.session import SessionLocal, engine
from app.services.search import search_professionals


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


# Lisboa tem profissionais no seed; Ponta Delgada, nos Açores, fica a mais de
# mil quilómetros de todos eles.
LISBOA = (38.7223, -9.1393)
PONTA_DELGADA = (37.7412, -25.6756)


def _grupos(outcome) -> list[str]:
    return [hit.group for hit in outcome.items]


def test_camadas_saem_sempre_na_mesma_ordem(db):
    """Região, depois outras localidades, depois destaques. Nunca ao contrário."""
    outcome = search_professionals(db, city="Braga", per_page=48)

    ordem = {"region": 0, "elsewhere": 1, "featured": 2}
    posicoes = [ordem[g] for g in _grupos(outcome)]
    assert posicoes == sorted(posicoes), f"camadas fora de ordem: {_grupos(outcome)}"


def test_a_localidade_ordena_mas_nao_corta(db):
    """Quem procura em Braga continua a ver o resto do país a seguir."""
    outcome = search_professionals(db, city="Braga", per_page=48)
    todos = search_professionals(db, per_page=48)

    assert outcome.region_total >= 1, "Braga tem profissional no seed"
    assert outcome.total == todos.total, "nenhum profissional pode ficar de fora"
    assert outcome.elsewhere_total + outcome.featured_total > 0


def test_camada_da_regiao_respeita_o_raio(db):
    """O raio deixou de filtrar o resultado, mas continua a definir a região."""
    outcome = search_professionals(db, lat=LISBOA[0], lng=LISBOA[1], radius_km=25, per_page=48)

    da_regiao = [h for h in outcome.items if h.group == "region"]
    assert da_regiao, "Lisboa tem profissionais dentro de 25 km"
    for hit in da_regiao:
        # Quem se desloca ao domicílio alcança mais longe que o próprio espaço.
        alcance = max(25, hit.professional.home_service_radius_km or 0) \
            if hit.professional.serves_at_home else 25
        assert hit.distance_km <= alcance


def test_outras_localidades_vem_do_mais_perto_para_o_mais_longe(db):
    outcome = search_professionals(db, city="Braga", per_page=48)

    distancias = [h.distance_km for h in outcome.items if h.group == "elsewhere"]
    assert len(distancias) > 1

    # Quem não tem coordenadas registadas não entra no cálculo e vai para o
    # fim: a ordem verifica-se entre os que têm distância.
    com_distancia = [d for d in distancias if d is not None]
    assert com_distancia == sorted(com_distancia)

    vistos_sem = False
    for d in distancias:
        if d is None:
            vistos_sem = True
        else:
            assert not vistos_sem, "um perfil com distância apareceu depois de um sem"


def test_destaques_vem_no_fim_e_tambem_por_proximidade(db):
    outcome = search_professionals(db, city="Braga", per_page=48)

    destaques = [h for h in outcome.items if h.group == "featured"]
    assert destaques, "o seed tem profissionais em destaque fora de Braga"
    assert all(h.professional.is_featured for h in destaques)

    distancias = [h.distance_km for h in destaques]
    assert distancias == sorted(distancias)


def test_destaque_dentro_da_regiao_fica_na_primeira_camada(db):
    """Estar em destaque não pode empurrar alguém da região para o fim."""
    outcome = search_professionals(db, city="Lisboa", per_page=48)

    da_regiao = [h for h in outcome.items if h.group == "region"]
    assert any(h.professional.is_featured for h in da_regiao), (
        "Lisboa tem destaques e eles pertencem à camada da região"
    )


def test_regiao_vazia_marca_a_pesquisa_como_alargada(db):
    """Ponta Delgada não tem ninguém: a primeira camada fica vazia."""
    outcome = search_professionals(db, lat=PONTA_DELGADA[0], lng=PONTA_DELGADA[1], radius_km=25)

    assert outcome.region_total == 0
    assert outcome.expanded is True
    assert outcome.total > 0, "tem de continuar a mostrar quem está mais longe"
    assert outcome.items[0].group in ("elsewhere", "featured")


def test_sem_localidade_esta_tudo_na_primeira_camada(db):
    outcome = search_professionals(db, per_page=48)

    assert outcome.expanded is False
    assert outcome.elsewhere_total == 0
    assert outcome.featured_total == 0
    assert outcome.region_total == outcome.total


def test_filtros_de_servico_valem_em_todas_as_camadas(db):
    """Alargar é sobre geografia, nunca sobre ignorar o que a pessoa pediu."""
    outcome = search_professionals(db, city="Braga", category="tatuagem", per_page=48)

    assert outcome.total > 0
    for hit in outcome.items:
        slugs = {c.slug for c in hit.professional.categories}
        assert "tatuagem" in slugs, f"{hit.professional.display_name} não faz tatuagem"


def test_filtro_sem_nenhum_resultado_continua_vazio(db):
    outcome = search_professionals(db, city="Braga", q="zzz serviço inexistente")

    assert outcome.total == 0
    assert outcome.items == []
    assert outcome.expanded is False


def test_paginacao_atravessa_as_camadas_sem_repetir(db):
    primeira = search_professionals(db, city="Braga", per_page=4, page=1)
    segunda = search_professionals(db, city="Braga", per_page=4, page=2)

    ids_a = [h.professional.id for h in primeira.items]
    ids_b = [h.professional.id for h in segunda.items]
    assert len(ids_a) == 4
    assert not set(ids_a) & set(ids_b), "a segunda página repetiu resultados"


def test_localidade_desconhecida_poe_tudo_nas_outras_camadas(db):
    outcome = search_professionals(db, city="Aldeia Inexistente do Norte", per_page=48)

    assert outcome.region_total == 0
    assert outcome.total > 0
    assert outcome.expanded is True


# --- filtro "em destaque" ----------------------------------------------------
def test_em_destaque_deixa_so_os_destacados(db):
    outcome = search_professionals(db, featured=True, per_page=48)
    todos = search_professionals(db, per_page=48)

    assert 0 < outcome.total < todos.total, "o filtro tem de cortar alguma coisa"
    for hit in outcome.items:
        assert hit.professional.is_featured, f"{hit.professional.display_name} não é destaque"


def test_em_destaque_soma_aos_outros_filtros(db):
    """Um filtro novo não pode apagar os que já lá estavam."""
    destaques = search_professionals(db, featured=True, per_page=48)
    manicures = search_professionals(db, category="manicure", per_page=48)
    ambos = search_professionals(db, featured=True, category="manicure", per_page=48)

    esperado = {h.professional.id for h in destaques.items} & {
        h.professional.id for h in manicures.items
    }
    assert {h.professional.id for h in ambos.items} == esperado


def test_em_destaque_continua_a_respeitar_as_camadas(db):
    """Pedir destaques não desliga a ordenação por região.

    A terceira camada existe para os destaques que ficaram *fora* da região.
    Quando são eles o conjunto todo, os que estão na região têm de subir à
    primeira camada — senão a localidade deixava de contar.
    """
    outcome = search_professionals(db, featured=True, city="Lisboa", per_page=48)

    ordem = {"region": 0, "elsewhere": 1, "featured": 2}
    posicoes = [ordem[hit.group] for hit in outcome.items]
    assert posicoes == sorted(posicoes)
    assert any(hit.group == "region" for hit in outcome.items), (
        "há destaques em Lisboa: têm de aparecer na camada da região"
    )


def test_em_destaque_sem_resultados_nao_estoira(db):
    outcome = search_professionals(
        db, featured=True, q="zzz serviço inexistente", per_page=48
    )
    assert outcome.total == 0
    assert outcome.items == []
