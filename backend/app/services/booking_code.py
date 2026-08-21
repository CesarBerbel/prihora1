"""Codigo curto de acompanhamento do agendamento.

E o que permite consultar ou avaliar um atendimento sem ter conta. Precisa ser
imprevisivel: um codigo sequencial deixaria qualquer pessoa varrer a agenda
alheia trocando o numero.
"""

import secrets
import string

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking

ALPHABET = string.ascii_uppercase + string.digits
PREFIX = "PH"


def new_booking_code(db: Session, length: int = 6) -> str:
    while True:
        code = PREFIX + "".join(secrets.choice(ALPHABET) for _ in range(length))
        if db.scalar(select(Booking.id).where(Booking.code == code)) is None:
            return code
