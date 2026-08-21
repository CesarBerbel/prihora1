"""Despesas do profissional.

O lado das receitas ja existe: sao as marcacoes. O que faltava era o outro
prato da balanca — o que sai — para que "quanto e que isto rendeu mesmo" tenha
resposta. Guardamos cada despesa com a data em que pesa, e nao a data em que
foi registada: uma renda de marco lancada em abril continua a ser de marco.

Valores em centimos e inteiros, como no resto do sistema, para nao apanhar os
erros de virgula flutuante que estragam somas de dinheiro.
"""

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.user import utcnow


class Expense(Base):
    __tablename__ = "expenses"
    __table_args__ = (
        # A pergunta e sempre "o que gastei neste mes".
        Index("ix_expense_pro_data", "professional_id", "incurred_on"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    professional_id: Mapped[int] = mapped_column(
        ForeignKey("professionals.id", ondelete="CASCADE"), nullable=False, index=True
    )

    description: Mapped[str] = mapped_column(String(160), nullable=False)
    # Categoria livre entre um punhado de rotulos conhecidos; ver
    # app.services.finance.EXPENSE_CATEGORIES.
    category: Mapped[str] = mapped_column(String(40), default="outros", nullable=False)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    incurred_on: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Despesa que se repete todos os meses (renda, seguro, software). Fica
    # registada uma vez e conta em todos os meses a partir da data indicada.
    recurring: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Quando a despesa recorrente deixa de existir. Nulo enquanto durar.
    ends_on: Mapped[date | None] = mapped_column(Date)

    notes: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    professional: Mapped["Professional"] = relationship(back_populates="expenses")  # noqa: F821
