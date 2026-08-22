"""Testes do motor de agenda. Rodam contra o Postgres do compose (make test)."""

from datetime import datetime, time, timedelta, timezone

import pytest
from sqlalchemy import select, text

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
from app.services.agenda import build_agenda, slot_is_free


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
    """Profissional descartavel, com grade de segunda a domingo, 09:00-12:00."""
    marca = datetime.now(timezone.utc).timestamp()
    user = User(
        name="Teste Agenda",
        email=f"agenda-{marca}@teste.local",
        password_hash="x",
        role=UserRole.PROFESSIONAL,
    )
    db.add(user)
    db.flush()

    pro = Professional(
        user_id=user.id,
        slug=f"teste-agenda-{marca}",
        display_name="Teste Agenda",
        status=ProfessionalStatus.ACTIVE,
        timezone="America/Sao_Paulo",
        slot_interval_min=30,
        min_notice_hours=0,
        max_advance_days=60,
    )
    db.add(pro)
    db.flush()

    for weekday in range(7):
        db.add(
            Availability(
                professional_id=pro.id,
                weekday=weekday,
                start_time=time(9, 0),
                end_time=time(12, 0),
            )
        )
    db.flush()
    return pro


def _amanha(pro) -> datetime.date:
    from zoneinfo import ZoneInfo

    return (datetime.now(ZoneInfo(pro.timezone)) + timedelta(days=1)).date()


def test_gera_slots_da_janela(db, profissional):
    """Janela 09:00-12:00, passo 30min, servico de 60min: 09:00 ate 11:00 = 5 slots."""
    dia = _amanha(profissional)
    agenda = build_agenda(db, profissional, dia, dia, duration_min=60)

    assert len(agenda.days) == 1
    dia_agenda = agenda.days[0]
    assert dia_agenda.is_open is True
    assert [s.label for s in dia_agenda.slots] == [
        "09:00", "09:30", "10:00", "10:30", "11:00"
    ]


def test_dia_sem_grade_fica_fechado(db, profissional):
    db.query(Availability).filter(
        Availability.professional_id == profissional.id
    ).delete()
    db.flush()

    dia = _amanha(profissional)
    agenda = build_agenda(db, profissional, dia, dia, duration_min=60)
    assert agenda.days[0].is_open is False
    assert agenda.days[0].slots == []


def test_agendamento_existente_remove_slots(db, profissional):
    dia = _amanha(profissional)
    agenda = build_agenda(db, profissional, dia, dia, duration_min=60)
    alvo = agenda.days[0].slots[0]

    db.add(
        Booking(
            code=f"T{int(datetime.now(timezone.utc).timestamp())%1000000:06d}",
            professional_id=profissional.id,
            client_name="Ocupado",
            client_phone="119",
            starts_at=alvo.start,
            ends_at=alvo.end,
            status=BookingStatus.CONFIRMED,
            service_name="Ocupado",
        )
    )
    db.flush()

    depois = build_agenda(db, profissional, dia, dia, duration_min=60)
    labels = [s.label for s in depois.days[0].slots]
    # 09:00 sai, e 09:30 tambem, porque um servico de 60min invadiria o horario ocupado.
    assert "09:00" not in labels
    assert "09:30" not in labels
    assert "10:00" in labels


def test_bloqueio_remove_o_dia_inteiro(db, profissional):
    dia = _amanha(profissional)
    agenda = build_agenda(db, profissional, dia, dia, duration_min=60)
    assert agenda.days[0].slots

    inicio = agenda.days[0].slots[0].start - timedelta(hours=1)
    db.add(
        TimeOff(
            professional_id=profissional.id,
            starts_at=inicio,
            ends_at=inicio + timedelta(hours=12),
            reason="Folga",
        )
    )
    db.flush()

    depois = build_agenda(db, profissional, dia, dia, duration_min=60)
    assert depois.days[0].slots == []


def test_antecedencia_minima_corta_slots_de_hoje(db, profissional):
    profissional.min_notice_hours = 720  # 30 dias
    db.flush()

    dia = _amanha(profissional)
    agenda = build_agenda(db, profissional, dia, dia + timedelta(days=3), duration_min=60)
    assert all(d.slots == [] for d in agenda.days)


def test_horizonte_maximo_limita_o_periodo(db, profissional):
    profissional.max_advance_days = 2
    db.flush()

    hoje = _amanha(profissional) - timedelta(days=1)
    agenda = build_agenda(db, profissional, hoje, hoje + timedelta(days=30), duration_min=60)
    assert len(agenda.days) <= 3


def test_slot_livre_aceita_horario_valido(db, profissional):
    dia = _amanha(profissional)
    agenda = build_agenda(db, profissional, dia, dia, duration_min=60)
    alvo = agenda.days[0].slots[0]

    ok, motivo = slot_is_free(db, profissional, alvo.start, alvo.end)
    assert ok is True
    assert motivo == ""


def test_slot_livre_recusa_horario_ja_reservado(db, profissional):
    dia = _amanha(profissional)
    agenda = build_agenda(db, profissional, dia, dia, duration_min=60)
    alvo = agenda.days[0].slots[0]

    db.add(
        Booking(
            code=f"U{int(datetime.now(timezone.utc).timestamp())%1000000:06d}",
            professional_id=profissional.id,
            client_name="Primeiro",
            client_phone="119",
            starts_at=alvo.start,
            ends_at=alvo.end,
            status=BookingStatus.PENDING,
            service_name="X",
        )
    )
    db.flush()

    ok, motivo = slot_is_free(db, profissional, alvo.start, alvo.end)
    assert ok is False
    assert "reservada" in motivo.lower()


def test_slot_livre_recusa_fora_da_grade(db, profissional):
    dia = _amanha(profissional)
    agenda = build_agenda(db, profissional, dia, dia, duration_min=60)
    alvo = agenda.days[0].slots[0]

    # 4 horas depois do inicio da grade ja passa das 12:00.
    fora = alvo.start + timedelta(hours=4)
    ok, motivo = slot_is_free(db, profissional, fora, fora + timedelta(hours=1))
    assert ok is False
    assert "fora do horário" in motivo.lower()


def test_slot_livre_respeita_antecedencia(db, profissional):
    profissional.min_notice_hours = 48
    db.flush()

    agora = datetime.now(timezone.utc)
    ok, motivo = slot_is_free(
        db, profissional, agora + timedelta(hours=1), agora + timedelta(hours=2)
    )
    assert ok is False
    assert "antecedência" in motivo.lower()


# --- o que o cliente ainda pode mudar sozinho --------------------------------
def _marcacao(professional, daqui_a_horas: float, estado=None):
    from app.models import Booking, BookingStatus

    inicio = datetime.now(timezone.utc) + timedelta(hours=daqui_a_horas)
    return Booking(
        code="PHTESTE",
        professional_id=professional.id,
        service_name="Teste",
        client_name="Cliente",
        client_phone="912 000 000",
        starts_at=inicio,
        ends_at=inicio + timedelta(hours=1),
        status=estado or BookingStatus.CONFIRMED,
        price_cents=1000,
    )


def test_dentro_do_prazo_o_cliente_muda_sozinho(db):
    from app.services.agenda import can_client_change

    profissional = db.scalars(select(Professional).limit(1)).first()
    anterior = profissional.cancel_notice_hours
    profissional.cancel_notice_hours = 24

    pode, motivo = can_client_change(profissional, _marcacao(profissional, 48))
    assert pode, motivo

    profissional.cancel_notice_hours = anterior


def test_fora_do_prazo_diz_porque(db):
    """A mensagem tem de nomear o prazo: "não pode" sozinho não ajuda ninguém."""
    from app.services.agenda import can_client_change

    profissional = db.scalars(select(Professional).limit(1)).first()
    anterior = profissional.cancel_notice_hours
    profissional.cancel_notice_hours = 24

    pode, motivo = can_client_change(profissional, _marcacao(profissional, 3))
    assert not pode
    assert "24h" in motivo
    assert "profissional" in motivo.lower()

    profissional.cancel_notice_hours = anterior


def test_prazo_a_zero_deixa_mudar_ate_a_hora(db):
    from app.services.agenda import can_client_change

    profissional = db.scalars(select(Professional).limit(1)).first()
    anterior = profissional.cancel_notice_hours
    profissional.cancel_notice_hours = 0

    assert can_client_change(profissional, _marcacao(profissional, 0.5))[0]
    # Mas o que já começou continua fechado, prazo zero ou não.
    assert not can_client_change(profissional, _marcacao(profissional, -0.5))[0]

    profissional.cancel_notice_hours = anterior


def test_o_que_ja_terminou_nao_se_muda(db):
    from app.models import BookingStatus
    from app.services.agenda import can_client_change

    profissional = db.scalars(select(Professional).limit(1)).first()
    for estado in (BookingStatus.CANCELLED, BookingStatus.COMPLETED, BookingStatus.NO_SHOW):
        pode, _ = can_client_change(profissional, _marcacao(profissional, 48, estado))
        assert not pode, estado


def test_uma_marcacao_nao_colide_consigo_mesma_ao_remarcar(db):
    """Sem a exclusão, mover uma marcação uma hora à frente dava conflito."""
    from app.services.agenda import has_booking_conflict

    profissional = db.scalars(select(Professional).limit(1)).first()
    marcacao = _marcacao(profissional, 72)
    db.add(marcacao)
    db.flush()

    inicio, fim = marcacao.starts_at, marcacao.ends_at
    assert has_booking_conflict(db, profissional, inicio, fim)
    assert not has_booking_conflict(
        db, profissional, inicio, fim, exclude_booking_id=marcacao.id
    )

    db.delete(marcacao)
    db.flush()
