"""pacotes de servicos e o saldo de quem os compra

Revision ID: 0010
Revises: 0009
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '0010'
down_revision: str | None = '0009'
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    # Criados à mão e depois referidos com `create_type=False`: sem isso, o
    # `create_table` tenta criá-los outra vez e a migração morre a meio.
    sa.Enum("SESSIONS", "COMBO", name="package_kind").create(op.get_bind(), checkfirst=True)
    sa.Enum(
        "ACTIVE", "USED", "EXPIRED", "CANCELLED", name="package_sale_status"
    ).create(op.get_bind(), checkfirst=True)

    package_kind = postgresql.ENUM(
        "SESSIONS", "COMBO", name="package_kind", create_type=False
    )
    sale_status = postgresql.ENUM(
        "ACTIVE", "USED", "EXPIRED", "CANCELLED", name="package_sale_status", create_type=False
    )

    op.create_table(
        "service_packages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("professional_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("kind", package_kind, nullable=False, server_default="SESSIONS"),
        sa.Column("price_cents", sa.Integer(), nullable=False),
        sa.Column("sessions", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("validity_days", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
        ),
        sa.ForeignKeyConstraint(["professional_id"], ["professionals.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_service_packages_professional_id", "service_packages", ["professional_id"])

    op.create_table(
        "package_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("package_id", sa.Integer(), nullable=False),
        sa.Column("service_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.ForeignKeyConstraint(["package_id"], ["service_packages.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["service_id"], ["services.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_package_items_package_id", "package_items", ["package_id"])

    op.create_table(
        "package_sales",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("professional_id", sa.Integer(), nullable=False),
        sa.Column("package_id", sa.Integer(), nullable=True),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("package_name", sa.String(length=160), nullable=False),
        sa.Column("kind", package_kind, nullable=False),
        sa.Column("price_cents", sa.Integer(), nullable=False),
        sa.Column("sessions_total", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("sessions_used", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("expires_on", sa.Date(), nullable=True),
        sa.Column("status", sale_status, nullable=False, server_default="ACTIVE"),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
        ),
        sa.ForeignKeyConstraint(["professional_id"], ["professionals.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["package_id"], ["service_packages.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["client_id"], ["professional_clients.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_package_sales_professional_id", "package_sales", ["professional_id"])
    op.create_index("ix_sale_pro_cliente", "package_sales", ["professional_id", "client_id"])

    # De que saldo saiu esta marcação. Nulo na esmagadora maioria: a marcação
    # avulsa continua a ser o caso comum.
    op.add_column("bookings", sa.Column("package_sale_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_bookings_package_sale", "bookings", "package_sales", ["package_sale_id"], ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_bookings_package_sale", "bookings", type_="foreignkey")
    op.drop_column("bookings", "package_sale_id")

    op.drop_index("ix_sale_pro_cliente", table_name="package_sales")
    op.drop_index("ix_package_sales_professional_id", table_name="package_sales")
    op.drop_table("package_sales")

    op.drop_index("ix_package_items_package_id", table_name="package_items")
    op.drop_table("package_items")

    op.drop_index("ix_service_packages_professional_id", table_name="service_packages")
    op.drop_table("service_packages")

    sa.Enum(name="package_sale_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="package_kind").drop(op.get_bind(), checkfirst=True)
