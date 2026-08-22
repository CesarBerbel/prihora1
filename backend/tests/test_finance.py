"""As contas do mês.

Dinheiro errado não dá erro: dá um número. Se a comissão for calculada sobre o
bruto errado, ou se um cancelado entrar no previsto, o ecrã mostra um valor
plausível e ninguém dá por nada até ao fim do mês. Daí a insistência destes
testes na fronteira entre *feito*, *previsto* e o que não conta para nenhum.
"""

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select, text

from app.db.session import SessionLocal, engine
from app.models import Booking, BookingStatus, Expense, Professional
from app.services.finance import (
    comissao,
    despesas_do_mes,
    month_bounds,
    resumo_do_mes,
)


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


# Um mês inteiro no passado, para não esbarrar na demonstração nem no relógio.
ANO, MES = 2032, 5
LISBOA = ZoneInfo("Europe/Lisbon")
# "Agora" fixo a meio do mês: antes disto é passado, depois é futuro.
AGORA = datetime(2032, 5, 15, 12, 0, tzinfo=timezone.utc)


# --- comissão, sem base de dados --------------------------------------------
def test_comissao_arredonda_ao_centimo():
    # 33,33 € a 15% dá 4,9995 €: arredonda para cima, e não trunca.
    assert comissao(3333, 15) == 500


def test_sem_comissao_nao_ha_nada_a_pagar():
    assert comissao(100_00, 0) == 0
    assert comissao(100_00, None) == 0


def test_percentagem_absurda_nao_gera_divida_absurda():
    """Um engano a escrever não pode produzir uma comissão maior que a receita."""
    assert comissao(100_00, 250) == 100_00
    assert comissao(100_00, -30) == 0


def test_comissao_de_tudo_e_tudo():
    assert comissao(4567, 100) == 4567


# --- fronteiras do mês -------------------------------------------------------
def test_o_mes_e_o_do_profissional_e_nao_o_do_servidor():
    inicio, fim = month_bounds(2032, 5, "Europe/Lisbon")
    assert inicio.day == 1 and fim.day == 1
    assert fim.month == 6
    # Em maio Lisboa está em UTC+1: a meia-noite local é 23h do dia anterior.
    assert inicio.astimezone(timezone.utc).hour == 23


def test_dezembro_salta_para_o_ano_seguinte():
    _, fim = month_bounds(2032, 12, "Europe/Lisbon")
    assert (fim.year, fim.month) == (2033, 1)


@pytest.fixture
def cenario(db):
    """Um mês com um de cada: concluído, confirmado futuro, pendente futuro,
    confirmado que já passou sem ninguém lhe tocar, cancelado e falta."""
    profissional = db.scalars(select(Professional).limit(1)).first()
    assert profissional is not None, "a base de demonstração tem de estar semeada"

    anterior = profissional.commission_percent
    profissional.commission_percent = 20.0

    def marcar(nome: str, dia: int, hora: int, estado: BookingStatus, euros: int) -> Booking:
        inicio = datetime(ANO, MES, dia, hora, tzinfo=LISBOA)
        booking = Booking(
            code=f"PHFIN{dia:02d}{hora:02d}",
            professional_id=profissional.id,
            service_name="Teste financeiro",
            client_name=nome,
            client_phone="912 000 002",
            starts_at=inicio,
            ends_at=inicio + timedelta(hours=1),
            status=estado,
            price_cents=euros * 100,
        )
        db.add(booking)
        return booking

    criadas = [
        marcar("concluido", 3, 10, BookingStatus.COMPLETED, 50),
        marcar("outro concluido", 8, 10, BookingStatus.COMPLETED, 30),
        marcar("confirmado futuro", 20, 10, BookingStatus.CONFIRMED, 40),
        marcar("pendente futuro", 22, 10, BookingStatus.PENDING, 25),
        marcar("confirmado esquecido", 5, 10, BookingStatus.CONFIRMED, 90),
        marcar("cancelado", 10, 10, BookingStatus.CANCELLED, 60),
        marcar("faltou", 12, 10, BookingStatus.NO_SHOW, 35),
        # Mês seguinte: não pode entrar nesta conta.
        marcar("do mes seguinte", 1, 10, BookingStatus.CONFIRMED, 999),
    ]
    criadas[-1].starts_at = datetime(ANO, MES + 1, 1, 10, tzinfo=LISBOA)
    criadas[-1].ends_at = criadas[-1].starts_at + timedelta(hours=1)

    db.flush()
    yield profissional
    for booking in criadas:
        db.delete(booking)
    profissional.commission_percent = anterior
    db.flush()


def _resumo(db, profissional):
    return resumo_do_mes(db, profissional, ANO, MES, agora=AGORA)


def test_feito_e_so_o_que_ja_aconteceu(db, cenario):
    resumo = _resumo(db, cenario)
    assert resumo.feito.quantidade == 2
    assert resumo.feito.bruto_cents == 80_00


def test_previsto_e_so_o_que_ainda_pode_acontecer(db, cenario):
    resumo = _resumo(db, cenario)
    # Confirmado de 40 € e pendente de 25 €. O confirmado que já passou e
    # ninguém concluiu não conta: não rendeu nem vai render.
    assert resumo.previsto.quantidade == 2
    assert resumo.previsto.bruto_cents == 65_00


def test_cancelados_e_faltas_ficam_de_fora_das_receitas(db, cenario):
    resumo = _resumo(db, cenario)
    assert resumo.perdido_quantidade == 2
    assert resumo.perdido_cents == 95_00
    # E não contaminam nenhum dos dois lados.
    assert resumo.feito.bruto_cents + resumo.previsto.bruto_cents == 145_00


def test_o_mes_seguinte_nao_entra_nesta_conta(db, cenario):
    resumo = _resumo(db, cenario)
    assert resumo.bruto_total_cents == 145_00, "999 € do mês seguinte apareceram aqui"


def test_a_comissao_sai_de_cada_lado_e_nao_do_total(db, cenario):
    """Separada, para que o líquido do feito não dependa do que ainda não aconteceu."""
    resumo = _resumo(db, cenario)
    assert resumo.feito.comissao_cents == 16_00       # 20% de 80 €
    assert resumo.previsto.comissao_cents == 13_00    # 20% de 65 €
    assert resumo.comissao_total_cents == 29_00
    assert resumo.feito.liquido_cents == 64_00


def test_sem_comissao_o_liquido_e_o_bruto(db, cenario):
    cenario.commission_percent = 0
    db.flush()
    resumo = _resumo(db, cenario)
    assert resumo.feito.comissao_cents == 0
    assert resumo.feito.liquido_cents == resumo.feito.bruto_cents


def test_o_dia_a_dia_soma_ao_total(db, cenario):
    resumo = _resumo(db, cenario)
    assert len(resumo.dias) == 31, "maio tem 31 dias"
    assert sum(d.feito_cents for d in resumo.dias) == resumo.feito.bruto_cents
    assert sum(d.previsto_cents for d in resumo.dias) == resumo.previsto.bruto_cents
    # E cada valor cai no dia certo.
    por_dia = {d.dia.day: d for d in resumo.dias}
    assert por_dia[3].feito_cents == 50_00
    assert por_dia[20].previsto_cents == 40_00


@pytest.fixture
def despesas(db, cenario):
    profissional = cenario
    criadas = [
        # Pontual dentro do mês.
        Expense(
            professional_id=profissional.id,
            description="Vernizes",
            category="material",
            amount_cents=30_00,
            incurred_on=date(ANO, MES, 7),
        ),
        # Pontual fora do mês.
        Expense(
            professional_id=profissional.id,
            description="Do mes passado",
            category="material",
            amount_cents=500_00,
            incurred_on=date(ANO, MES - 1, 7),
        ),
        # Recorrente que começou antes e ainda dura.
        Expense(
            professional_id=profissional.id,
            description="Renda do espaço",
            category="espaco",
            amount_cents=200_00,
            incurred_on=date(ANO - 1, 1, 1),
            recurring=True,
        ),
        # Recorrente que já acabou antes deste mês.
        Expense(
            professional_id=profissional.id,
            description="Software antigo",
            category="software",
            amount_cents=15_00,
            incurred_on=date(ANO - 1, 1, 1),
            recurring=True,
            ends_on=date(ANO, MES - 2, 28),
        ),
        # Recorrente que só começa depois deste mês.
        Expense(
            professional_id=profissional.id,
            description="Seguro futuro",
            category="outros",
            amount_cents=40_00,
            incurred_on=date(ANO, MES + 2, 1),
            recurring=True,
        ),
    ]
    for despesa in criadas:
        db.add(despesa)
    db.flush()
    yield profissional
    for despesa in criadas:
        db.delete(despesa)
    db.flush()


def test_so_pesam_as_despesas_do_mes(db, despesas):
    inicio, fim = month_bounds(ANO, MES, "Europe/Lisbon")
    encontradas = {
        e.description
        for e in despesas_do_mes(
            db, despesas.id, inicio.date(), (fim - timedelta(days=1)).date()
        )
    }
    assert "Vernizes" in encontradas
    assert "Renda do espaço" in encontradas, "uma recorrente em vigor pesa todos os meses"
    assert "Do mes passado" not in encontradas
    assert "Software antigo" not in encontradas, "uma recorrente que acabou deixa de pesar"
    assert "Seguro futuro" not in encontradas, "uma recorrente ainda não começou"


def test_o_resultado_desconta_comissao_e_despesas(db, despesas):
    resumo = resumo_do_mes(db, despesas, ANO, MES, agora=AGORA)
    # 30 € de material + 200 € de renda.
    assert resumo.despesas_cents == 230_00
    assert resumo.despesas_por_categoria == {"material": 30_00, "espaco": 200_00}

    # Feito 80 €, menos 16 € de comissão, menos 230 € de despesas.
    assert resumo.resultado_cents == 80_00 - 16_00 - 230_00
    # Projetado acrescenta o previsto já líquido: 65 € menos 13 €.
    assert resumo.resultado_projetado_cents == resumo.resultado_cents + 52_00


def test_o_projetado_nunca_e_pior_que_o_feito(db, despesas):
    """O previsto só pode acrescentar: se fosse menor, era sinal de erro de sinal."""
    resumo = resumo_do_mes(db, despesas, ANO, MES, agora=AGORA)
    assert resumo.resultado_projetado_cents >= resumo.resultado_cents


def test_um_mes_vazio_da_zeros_e_nao_estoiro(db, cenario):
    resumo = resumo_do_mes(db, cenario, 2019, 2, agora=AGORA)
    assert resumo.feito.bruto_cents == 0
    assert resumo.previsto.bruto_cents == 0
    assert resumo.resultado_cents == 0
    assert len(resumo.dias) == 28


# --- pacotes de serviços -----------------------------------------------------
def test_um_combinado_e_sempre_uma_sessao(db):
    """Os serviços fazem-se de seguida: não há saldo para gastar depois."""
    from app.models import PackageKind, ServicePackage
    from app.services.packages import sessoes_do_pacote

    combo = ServicePackage(kind=PackageKind.COMBO, sessions=5, name="x", price_cents=0)
    assert sessoes_do_pacote(combo) == 1

    sessoes = ServicePackage(kind=PackageKind.SESSIONS, sessions=5, name="x", price_cents=0)
    assert sessoes_do_pacote(sessoes) == 5


def test_o_saldo_conta_o_que_segura_o_credito(db):
    """Cancelar devolve a sessão; concluir e faltar continuam a segurá-la.

    O saldo sai da contagem das marcações e não de um contador incrementado à
    mão — um contador fica errado à primeira exceção, e ninguém dá por isso
    até faltar uma sessão ao cliente.
    """
    from app.models import BookingStatus
    from app.services.packages import SEGURA_CREDITO

    assert BookingStatus.CONFIRMED in SEGURA_CREDITO
    assert BookingStatus.COMPLETED in SEGURA_CREDITO
    assert BookingStatus.PENDING in SEGURA_CREDITO
    # A falta consome: o horário foi reservado e perdido.
    assert BookingStatus.NO_SHOW in SEGURA_CREDITO
    # O cancelamento devolve.
    assert BookingStatus.CANCELLED not in SEGURA_CREDITO


def test_um_pacote_esgotado_ou_expirado_nao_marca_mais(db):
    from datetime import date, timedelta

    from app.models import PackageKind, PackageSale, PackageSaleStatus
    from app.services.packages import esta_disponivel

    hoje = date(2030, 5, 10)

    def venda(**campos):
        base = dict(
            professional_id=1, client_id=1, package_name="x", kind=PackageKind.SESSIONS,
            price_cents=0, sessions_total=5, sessions_used=0,
            status=PackageSaleStatus.ACTIVE, expires_on=None,
        )
        base.update(campos)
        return PackageSale(**base)

    assert esta_disponivel(venda(), hoje=hoje)[0]
    assert not esta_disponivel(venda(sessions_used=5), hoje=hoje)[0]
    assert not esta_disponivel(venda(expires_on=hoje - timedelta(days=1)), hoje=hoje)[0]
    # Expira hoje ainda dá: o prazo é até ao fim do dia.
    assert esta_disponivel(venda(expires_on=hoje), hoje=hoje)[0]
    assert not esta_disponivel(venda(status=PackageSaleStatus.CANCELLED), hoje=hoje)[0]


def test_a_poupanca_e_a_razao_de_ser_do_pacote(db):
    """O valor avulso de um pacote de sessões multiplica; o de um combinado soma."""
    from app.models import PackageItem, PackageKind, ServicePackage
    from app.services.packages import duracao_total, valor_avulso

    class ServicoFalso:
        def __init__(self, duracao, preco):
            self.duration_min, self.price_cents = duracao, preco

    a, b = ServicoFalso(45, 1400), ServicoFalso(90, 3000)

    pacote = ServicePackage(kind=PackageKind.SESSIONS, sessions=5, name="x", price_cents=6000)
    item = PackageItem(position=0)
    item.service = a
    pacote.items = [item]
    assert valor_avulso(pacote) == 1400 * 5
    assert duracao_total(pacote) == 45, "cada sessão é uma; não se somam"

    combo = ServicePackage(kind=PackageKind.COMBO, name="y", price_cents=4000)
    i1, i2 = PackageItem(position=0), PackageItem(position=1)
    i1.service, i2.service = a, b
    combo.items = [i1, i2]
    assert valor_avulso(combo) == 1400 + 3000
    assert duracao_total(combo) == 135, "acontecem de seguida: as durações somam"
