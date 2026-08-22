"""prazo para o cliente cancelar ou remarcar sozinho

Revision ID: 0009
Revises: 0008
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = '0009'
down_revision: str | None = '0008'
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    # 24 horas por omissão. O server_default é o que permite acrescentar uma
    # coluna NOT NULL a uma tabela que já tem linhas.
    op.add_column(
        "professionals",
        sa.Column(
            "cancel_notice_hours",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("24"),
        ),
    )


def downgrade() -> None:
    op.drop_column("professionals", "cancel_notice_hours")
