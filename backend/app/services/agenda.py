"""Motor da agenda publica: gera os horarios livres de um profissional.

Regras aplicadas, em ordem:
  1. so dentro das janelas semanais de disponibilidade;
  2. respeitando a antecedencia minima (min_notice_hours);
  3. no maximo max_advance_days a frente;
  4. sem colidir com agendamentos pendentes ou confirmados;
  5. sem colidir com bloqueios (folgas, ferias).
"""

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Availability, Booking, BookingStatus, Professional, TimeOff
from app.schemas.booking import AgendaOut, DayAgenda, SlotOut

MAX_RANGE_DAYS = 62


def _tz(professional: Professional) -> ZoneInfo:
    try:
        return ZoneInfo(professional.timezone or "Europe/Lisbon")
    except Exception:
        return ZoneInfo("Europe/Lisbon")


def _overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    return a_start < b_end and b_start < a_end


def build_agenda(
    db: Session,
    professional: Professional,
    date_from: date,
    date_to: date,
    duration_min: int,
    service_id: int | None = None,
) -> AgendaOut:
    tz = _tz(professional)
    now_utc = datetime.now(timezone.utc)

    if date_to < date_from:
        date_to = date_from
    if (date_to - date_from).days > MAX_RANGE_DAYS:
        date_to = date_from + timedelta(days=MAX_RANGE_DAYS)

    horizon = (now_utc + timedelta(days=professional.max_advance_days)).astimezone(tz).date()
    if date_to > horizon:
        date_to = horizon

    earliest = now_utc + timedelta(hours=professional.min_notice_hours)

    windows: dict[int, list[tuple[time, time]]] = {}
    rows = db.scalars(
        select(Availability).where(Availability.professional_id == professional.id)
    ).all()
    for row in rows:
        windows.setdefault(row.weekday, []).append((row.start_time, row.end_time))
    for day_windows in windows.values():
        day_windows.sort()

    range_start = datetime.combine(date_from, time.min, tzinfo=tz).astimezone(timezone.utc)
    range_end = (
        datetime.combine(date_to, time.min, tzinfo=tz) + timedelta(days=1)
    ).astimezone(timezone.utc)

    busy: list[tuple[datetime, datetime]] = []

    booked = db.scalars(
        select(Booking).where(
            Booking.professional_id == professional.id,
            Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
            Booking.ends_at > range_start,
            Booking.starts_at < range_end,
        )
    ).all()
    busy.extend((b.starts_at, b.ends_at) for b in booked)

    offs = db.scalars(
        select(TimeOff).where(
            TimeOff.professional_id == professional.id,
            TimeOff.ends_at > range_start,
            TimeOff.starts_at < range_end,
        )
    ).all()
    busy.extend((o.starts_at, o.ends_at) for o in offs)

    step = timedelta(minutes=max(professional.slot_interval_min or 30, 5))
    duration = timedelta(minutes=duration_min)

    days: list[DayAgenda] = []
    cursor = date_from
    while cursor <= date_to:
        weekday = cursor.weekday()
        day_windows = windows.get(weekday, [])
        slots: list[SlotOut] = []

        for start_t, end_t in day_windows:
            window_start = datetime.combine(cursor, start_t, tzinfo=tz)
            window_end = datetime.combine(cursor, end_t, tzinfo=tz)
            if window_end <= window_start:
                window_end += timedelta(days=1)

            slot_start = window_start
            while slot_start + duration <= window_end:
                slot_end = slot_start + duration
                start_utc = slot_start.astimezone(timezone.utc)
                end_utc = slot_end.astimezone(timezone.utc)

                if start_utc >= earliest and not any(
                    _overlaps(start_utc, end_utc, bs, be) for bs, be in busy
                ):
                    slots.append(
                        SlotOut(
                            start=start_utc,
                            end=end_utc,
                            label=slot_start.strftime("%H:%M"),
                        )
                    )
                slot_start += step

        days.append(
            DayAgenda(date=cursor, weekday=weekday, is_open=bool(day_windows), slots=slots)
        )
        cursor += timedelta(days=1)

    return AgendaOut(
        professional_slug=professional.slug,
        timezone=str(tz),
        service_id=service_id,
        duration_min=duration_min,
        days=days,
    )


def has_booking_conflict(
    db: Session,
    professional: Professional,
    start_utc: datetime,
    end_utc: datetime,
    *,
    exclude_booking_id: int | None = None,
) -> bool:
    """Ha outro atendimento ocupando esta faixa de horario?

    E a unica trava que vale para os lancamentos feitos pelo profissional no
    painel: ele pode marcar fora do expediente e por cima de um bloqueio, mas
    nao pode estar em dois lugares ao mesmo tempo.
    """
    query = select(Booking.id).where(
        Booking.professional_id == professional.id,
        Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
        Booking.starts_at < end_utc,
        Booking.ends_at > start_utc,
    )
    if exclude_booking_id is not None:
        query = query.where(Booking.id != exclude_booking_id)

    return db.scalar(query) is not None


def slot_is_free(
    db: Session, professional: Professional, start_utc: datetime, end_utc: datetime
) -> tuple[bool, str]:
    """Revalida um horario na hora da reserva, evitando corrida entre dois clientes."""
    now_utc = datetime.now(timezone.utc)

    if start_utc < now_utc + timedelta(hours=professional.min_notice_hours):
        return False, f"Este profissional pede {professional.min_notice_hours}h de antecedência."
    if start_utc > now_utc + timedelta(days=professional.max_advance_days):
        return False, f"Não aceita marcações com mais de {professional.max_advance_days} dias de antecedência."

    tz = _tz(professional)
    local_start = start_utc.astimezone(tz)
    local_end = end_utc.astimezone(tz)

    windows = db.scalars(
        select(Availability).where(
            Availability.professional_id == professional.id,
            Availability.weekday == local_start.weekday(),
        )
    ).all()
    inside = False
    for w in windows:
        w_start = datetime.combine(local_start.date(), w.start_time, tzinfo=tz)
        w_end = datetime.combine(local_start.date(), w.end_time, tzinfo=tz)
        if w_end <= w_start:
            w_end += timedelta(days=1)
        if w_start <= local_start and local_end <= w_end:
            inside = True
            break
    if not inside:
        return False, "Hora fora do horário de atendimento do profissional."

    if has_booking_conflict(db, professional, start_utc, end_utc):
        return False, "Esta hora acabou de ser reservada. Escolha outra."

    blocked = db.scalar(
        select(TimeOff.id).where(
            TimeOff.professional_id == professional.id,
            TimeOff.starts_at < end_utc,
            TimeOff.ends_at > start_utc,
        )
    )
    if blocked:
        return False, "O profissional bloqueou este período na agenda."

    return True, ""


def bookings_in_window(
    db: Session,
    professional_id: int,
    inicio: datetime | None,
    fim: datetime | None,
    *,
    status: BookingStatus | None = None,
    limit: int = 500,
) -> list[Booking]:
    """As marcações que *tocam* uma janela de tempo.

    Serve o calendário, que carrega só o que está à vista. A regra é tocar e
    não começar dentro: um atendimento das 23h30 de domingo pertence à semana
    que acaba, mesmo que termine já na seguinte — e tem de aparecer nas duas,
    cortado à meia-noite. Pedir só o que começa na janela deixaria um buraco
    no cimo de cada vista.

    O fim é exclusivo. A janela do calendário fecha no início do dia seguinte
    ao último visível, portanto uma marcação que comece exactamente aí é da
    vista seguinte — incluí-la não a faria aparecer no desenho (fica fora de
    todos os dias), mas contaria a dobrar no resumo lateral da semana.
    """
    query = select(Booking).where(Booking.professional_id == professional_id)
    if status is not None:
        query = query.where(Booking.status == status)
    if inicio is not None:
        query = query.where(Booking.ends_at >= inicio)
    if fim is not None:
        query = query.where(Booking.starts_at < fim)
    return list(db.scalars(query.order_by(Booking.starts_at.desc()).limit(limit)).all())
