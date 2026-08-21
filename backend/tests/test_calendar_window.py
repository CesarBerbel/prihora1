"""A janela de tempo que o calendário pede ao servidor.

O calendário carrega só o que está à vista. O perigo aqui é silencioso: uma
marcação que fique de fora não dá erro nenhum — a semana desenha-se na mesma,
apenas sem ela. Estes testes prendem a regra de "tocar a janela".
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select, text

from app.db.session import SessionLocal, engine
from app.models import Booking, BookingStatus, Professional, Service
from app.services.agenda import bookings_in_window


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


# Uma semana inteira, como a vista de semana a pede: de segunda a segunda.
SEGUNDA = datetime(2031, 3, 3, 0, 0, tzinfo=timezone.utc)
SEGUNDA_SEGUINTE = SEGUNDA + timedelta(days=7)


@pytest.fixture
def cenario(db):
    """Marcações à volta das duas pontas da semana, e uma bem no meio."""
    profissional = db.scalars(select(Professional).limit(1)).first()
    assert profissional is not None, "a base de demonstração tem de estar semeada"
    servico = db.scalars(
        select(Service).where(Service.professional_id == profissional.id).limit(1)
    ).first()

    def marcar(nome: str, inicio: datetime, horas: float) -> Booking:
        booking = Booking(
            code=f"PHTEST{abs(hash(nome)) % 100000:05d}",
            professional_id=profissional.id,
            service_id=servico.id if servico else None,
            service_name="Teste de janela",
            client_name=nome,
            client_phone="912 000 001",
            starts_at=inicio,
            ends_at=inicio + timedelta(hours=horas),
            status=BookingStatus.CONFIRMED,
            price_cents=1000,
        )
        db.add(booking)
        return booking

    criadas = {
        # Acaba antes de a semana abrir: fica de fora.
        "antes": marcar("antes", SEGUNDA - timedelta(hours=3), 1),
        # Comeca no sabado anterior e entra pela segunda dentro: tem de aparecer.
        "entra": marcar("entra", SEGUNDA - timedelta(hours=1), 2),
        "meio": marcar("meio", SEGUNDA + timedelta(days=3, hours=10), 1),
        # Comeca no domingo a noite e acaba na segunda seguinte: tem de aparecer.
        "sai": marcar("sai", SEGUNDA_SEGUINTE - timedelta(minutes=30), 2),
        # Comeca exactamente quando a semana fecha: ja e da seguinte.
        "depois": marcar("depois", SEGUNDA_SEGUINTE, 1),
    }
    db.flush()
    yield profissional, criadas
    for booking in criadas.values():
        db.delete(booking)
    db.flush()


def _nomes(db, profissional, de, ate) -> set[str]:
    return {b.client_name for b in bookings_in_window(db, profissional.id, de, ate)}


def test_apanha_quem_toca_a_janela_e_deixa_o_resto(db, cenario):
    profissional, _ = cenario
    nomes = _nomes(db, profissional, SEGUNDA, SEGUNDA_SEGUINTE)

    assert "meio" in nomes
    assert "entra" in nomes, "uma marcação que atravessa a segunda de manhã tem de aparecer"
    assert "sai" in nomes, "uma marcação que atravessa o domingo à noite tem de aparecer"
    assert "antes" not in nomes
    assert "depois" not in nomes, "quem começa quando a janela fecha já é da vista seguinte"


def test_semanas_seguidas_nao_deixam_buraco(db, cenario):
    """Tudo o que existe tem de estar em pelo menos uma das duas semanas."""
    profissional, criadas = cenario
    esta = _nomes(db, profissional, SEGUNDA, SEGUNDA_SEGUINTE)
    proxima = _nomes(db, profissional, SEGUNDA_SEGUINTE, SEGUNDA_SEGUINTE + timedelta(days=7))

    for nome in ("entra", "meio", "sai", "depois"):
        assert nome in esta | proxima, f"{nome} desapareceu das duas semanas"

    # E a que atravessa a fronteira aparece nas duas, para poder ser cortada.
    assert "sai" in esta and "sai" in proxima


def test_sem_limites_devolve_tudo(db, cenario):
    profissional, _ = cenario
    nomes = _nomes(db, profissional, None, None)
    for nome in ("antes", "entra", "meio", "sai", "depois"):
        assert nome in nomes


def test_o_filtro_de_estado_continua_a_valer(db, cenario):
    profissional, criadas = cenario
    criadas["meio"].status = BookingStatus.CANCELLED
    db.flush()

    sobreviventes = {
        b.client_name
        for b in bookings_in_window(
            db, profissional.id, SEGUNDA, SEGUNDA_SEGUINTE, status=BookingStatus.CONFIRMED
        )
    }
    assert "meio" not in sobreviventes
    assert "entra" in sobreviventes


def test_nao_mostra_a_agenda_de_outro_profissional(db, cenario):
    profissional, _ = cenario
    outro = db.scalars(
        select(Professional).where(Professional.id != profissional.id).limit(1)
    ).first()
    if outro is None:
        pytest.skip("só há um profissional semeado")

    nomes = _nomes(db, outro, SEGUNDA, SEGUNDA_SEGUINTE)
    assert "meio" not in nomes
