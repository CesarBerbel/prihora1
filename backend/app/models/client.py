"""Cadastro de clientes, proprio de cada profissional.

E uma agenda de contatos particular: dois profissionais podem ter a mesma
pessoa cadastrada, cada um com suas anotacoes. Nao se confunde com a conta de
usuario do prihora, que e opcional e pode nem existir.
"""

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.user import utcnow


# Portugal: 9 dígitos, indicativo do país 351.
COUNTRY_CODE = "351"
NATIONAL_LENGTH = 9


def phone_digits(phone: str | None) -> str:
    """Forma canónica do telefone, para comparar números escritos de modos diferentes.

    Guarda sempre o número nacional de 9 dígitos: assim "+351 912 345 678",
    "912345678" e "912 345 678" são reconhecidos como a mesma pessoa.
    """
    digits = "".join(ch for ch in (phone or "") if ch.isdigit())

    if digits.startswith("00" + COUNTRY_CODE):
        digits = digits[len("00" + COUNTRY_CODE) :]
    elif digits.startswith(COUNTRY_CODE) and len(digits) > NATIONAL_LENGTH:
        digits = digits[len(COUNTRY_CODE) :]

    return digits


class ProfessionalClient(Base):
    __tablename__ = "professional_clients"
    __table_args__ = (
        # Busca por telefone ao vincular um agendamento novo.
        Index("ix_client_pro_phone", "professional_id", "phone_digits"),
        Index("ix_client_pro_name", "professional_id", "name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    professional_id: Mapped[int] = mapped_column(
        ForeignKey("professionals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Preenchido quando a pessoa tambem tem conta no prihora.
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32))
    # Versao normalizada do telefone. Nao ha unicidade de proposito: mae e
    # filha podem dividir o mesmo numero.
    phone_digits: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    email: Mapped[str | None] = mapped_column(String(255))

    birth_date: Mapped[date | None] = mapped_column(Date)
    address_line: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Marca quem entrou sozinho, a partir de um agendamento publico.
    created_from_booking: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    professional = relationship("Professional", back_populates="clients")
    bookings = relationship("Booking", back_populates="professional_client")
