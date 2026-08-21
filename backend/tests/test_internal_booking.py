"""Agendamento lancado pelo profissional no painel.

Regra: pode passar por cima do expediente e dos bloqueios; nao pode concorrer
com outro atendimento.
"""

from datetime import datetime, time, timedelta, timezone

import pytest
from sqlalchemy import text

from app.db.session import SessionLocal, engine
from app.models import (
    Availability,
    Booking,
    BookingStatus,
    Professional,
    ProfessionalStatus,
    TimeOff,
    User,
    UserRole,
)
from app.services.agenda import has_booking_conflict, slot_is_free


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
    """Atende so segunda, 09:00-12:00. Todo o resto e fora do expediente."""
    marca = datetime.now(timezone.utc).timestamp()
    user = User(
        name="Teste Interno",
        email=f"interno-{marca}@teste.local",
        password_hash="x",
        role=UserRole.PROFESSIONAL,
    )
    db.add(user)
    db.flush()

    pro = Professional(
        user_id=user.id,
        slug=f"teste-interno-{marca}",
        display_name="Teste Interno",
        status=ProfessionalStatus.ACTIVE,
        timezone="America/Sao_Paulo",
        slot_interval_min=30,
        min_notice_hours=2,
    )
    db.add(pro)
    db.flush()
    db.add(
        Availability(
            professional_id=pro.id, weekday=0, start_time=time(9, 0), end_time=time(12, 0)
        )
    )
    db.flush()
    return pro


def _booking(pro, inicio, minutos=60, status=BookingStatus.CONFIRMED):
    return Booking(
        code=f"T{int(inicio.timestamp()) % 1000000:06d}",
        professional_id=pro.id,
        client_name="Cliente",
        client_phone="119",
        starts_at=inicio,
        ends_at=inicio + timedelta(minutes=minutos),
        status=status,
        service_name="Servico",
    )


def _proxima_quarta_23h() -> datetime:
    """Um horario que a agenda publica jamais ofereceria."""
    d = datetime.now(timezone.utc) + timedelta(days=1)
    while d.weekday() != 2:
        d += timedelta(days=1)
    return d.replace(hour=23, minute=0, second=0, microsecond=0)


def test_horario_fora_do_expediente_esta_livre_para_o_painel(db, profissional):
    inicio = _proxima_quarta_23h()
    fim = inicio + timedelta(hours=1)

    # A agenda publica recusa.
    ok, motivo = slot_is_free(db, profissional, inicio, fim)
    assert ok is False
    assert "fora do horário" in motivo.lower()

    # O painel nao ve conflito nenhum.
    assert has_booking_conflict(db, profissional, inicio, fim) is False


def test_bloqueio_nao_impede_o_lancamento_do_painel(db, profissional):
    inicio = _proxima_quarta_23h()
    fim = inicio + timedelta(hours=1)

    db.add(
        TimeOff(
            professional_id=profissional.id,
            starts_at=inicio - timedelta(hours=2),
            ends_at=fim + timedelta(hours=2),
            reason="Ferias",
        )
    )
    db.flush()

    # A agenda publica recusa por causa do bloqueio...
    ok, _ = slot_is_free(db, profissional, inicio, fim)
    assert ok is False
    # ...mas o profissional pode lancar por cima.
    assert has_booking_conflict(db, profissional, inicio, fim) is False


def test_outro_atendimento_no_mesmo_horario_bloqueia(db, profissional):
    inicio = _proxima_quarta_23h()
    fim = inicio + timedelta(hours=1)

    db.add(_booking(profissional, inicio))
    db.flush()

    assert has_booking_conflict(db, profissional, inicio, fim) is True


def test_sobreposicao_parcial_tambem_bloqueia(db, profissional):
    inicio = _proxima_quarta_23h()
    db.add(_booking(profissional, inicio, minutos=60))
    db.flush()

    # Comeca 30 min depois: invade a segunda metade do atendimento existente.
    assert has_booking_conflict(
        db, profissional, inicio + timedelta(minutes=30), inicio + timedelta(minutes=90)
    ) is True
    # Termina exatamente quando o outro comeca: encosta, mas nao sobrepoe.
    assert has_booking_conflict(
        db, profissional, inicio - timedelta(minutes=60), inicio
    ) is False


def test_atendimento_cancelado_libera_o_horario(db, profissional):
    inicio = _proxima_quarta_23h()
    fim = inicio + timedelta(hours=1)

    db.add(_booking(profissional, inicio, status=BookingStatus.CANCELLED))
    db.flush()

    assert has_booking_conflict(db, profissional, inicio, fim) is False


def test_ao_reagendar_o_proprio_atendimento_ele_nao_conta_como_conflito(db, profissional):
    inicio = _proxima_quarta_23h()
    fim = inicio + timedelta(hours=1)

    booking = _booking(profissional, inicio)
    db.add(booking)
    db.flush()

    assert has_booking_conflict(db, profissional, inicio, fim) is True
    assert has_booking_conflict(
        db, profissional, inicio, fim, exclude_booking_id=booking.id
    ) is False


def test_conflito_e_por_profissional(db, profissional):
    """A agenda de um nao pode bloquear a do outro."""
    marca = datetime.now(timezone.utc).timestamp()
    outro_user = User(
        name="Outro", email=f"outro-{marca}@teste.local", password_hash="x",
        role=UserRole.PROFESSIONAL,
    )
    db.add(outro_user)
    db.flush()
    outro = Professional(
        user_id=outro_user.id, slug=f"outro-{marca}", display_name="Outro",
        status=ProfessionalStatus.ACTIVE,
    )
    db.add(outro)
    db.flush()

    inicio = _proxima_quarta_23h()
    db.add(_booking(profissional, inicio))
    db.flush()

    assert has_booking_conflict(db, outro, inicio, inicio + timedelta(hours=1)) is False
