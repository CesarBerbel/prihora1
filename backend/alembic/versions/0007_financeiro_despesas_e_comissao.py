"""financeiro: despesas e comissao devida

Revision ID: 0007
Revises: 0006
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = '0007'
down_revision: str | None = '0006'
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    # Percentagem devida a terceiros sobre cada atendimento. Quem já tem perfil
    # não deve nada a ninguém até dizer o contrário, daí o zero por omissão —
    # e o server_default, sem o qual a coluna NOT NULL não entraria numa tabela
    # que já tem linhas.
    op.add_column(
        "professionals",
        sa.Column(
            "commission_percent",
            sa.Float(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )

    op.create_table(
        "expenses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("professional_id", sa.Integer(), nullable=False),
        sa.Column("description", sa.String(length=160), nullable=False),
        sa.Column(
            "category", sa.String(length=40), nullable=False, server_default=sa.text("'outros'")
        ),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("incurred_on", sa.Date(), nullable=False),
        sa.Column(
            "recurring", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column("ends_on", sa.Date(), nullable=True),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["professional_id"], ["professionals.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_expenses_professional_id", "expenses", ["professional_id"])
    op.create_index("ix_expenses_incurred_on", "expenses", ["incurred_on"])
    # A pergunta do ecrã é sempre "o que gastei neste mês".
    op.create_index("ix_expense_pro_data", "expenses", ["professional_id", "incurred_on"])


def downgrade() -> None:
    op.drop_index("ix_expense_pro_data", table_name="expenses")
    op.drop_index("ix_expenses_incurred_on", table_name="expenses")
    op.drop_index("ix_expenses_professional_id", table_name="expenses")
    op.drop_table("expenses")
    op.drop_column("professionals", "commission_percent")
