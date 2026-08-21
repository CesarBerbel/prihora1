"""Ficha de cliente na agenda particular do profissional."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Booking, ProfessionalClient, phone_digits


def find_client(
    db: Session, professional_id: int, *, phone: str | None, email: str | None = None
) -> ProfessionalClient | None:
    """Procura uma ficha existente pelo telefone e, em ultimo caso, pelo e-mail."""
    digits = phone_digits(phone)

    if digits:
        found = db.scalars(
            select(ProfessionalClient)
            .where(
                ProfessionalClient.professional_id == professional_id,
                ProfessionalClient.phone_digits == digits,
            )
            .order_by(ProfessionalClient.created_at.desc())
            .limit(1)
        ).first()
        if found:
            return found

    if email:
        return db.scalars(
            select(ProfessionalClient)
            .where(
                ProfessionalClient.professional_id == professional_id,
                func.lower(ProfessionalClient.email) == email.lower().strip(),
            )
            .order_by(ProfessionalClient.created_at.desc())
            .limit(1)
        ).first()

    return None


def find_or_create_client(
    db: Session,
    professional_id: int,
    *,
    name: str,
    phone: str | None,
    email: str | None = None,
    user_id: int | None = None,
    from_booking: bool = False,
) -> ProfessionalClient:
    """Reaproveita a ficha existente ou abre uma nova.

    Usado quando chega um agendamento pela agenda publica: a lista de clientes
    do profissional vai se formando sozinha, sem digitacao.
    """
    existing = find_client(db, professional_id, phone=phone, email=email)
    if existing:
        # Completa o que faltava, sem sobrescrever o que o profissional editou.
        if not existing.email and email:
            existing.email = email.strip()
        if not existing.user_id and user_id:
            existing.user_id = user_id
        if not existing.is_active:
            existing.is_active = True
        return existing

    client = ProfessionalClient(
        professional_id=professional_id,
        name=name.strip(),
        phone=(phone or "").strip() or None,
        phone_digits=phone_digits(phone),
        email=(email or "").strip() or None,
        user_id=user_id,
        created_from_booking=from_booking,
    )
    db.add(client)
    db.flush()
    return client


def client_summary(db: Session, client_ids: list[int]) -> dict[int, dict]:
    """Total de atendimentos e data do ultimo, para a listagem."""
    if not client_ids:
        return {}

    rows = db.execute(
        select(
            Booking.professional_client_id,
            func.count(Booking.id),
            func.max(Booking.starts_at),
        )
        .where(Booking.professional_client_id.in_(client_ids))
        .group_by(Booking.professional_client_id)
    ).all()

    return {
        client_id: {"bookings_count": int(total), "last_visit_at": last}
        for client_id, total, last in rows
    }
