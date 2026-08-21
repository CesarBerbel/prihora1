"""so whatsapp, texto por destinatario

Revision ID: 0006
Revises: 0005
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '0006'
down_revision: str | None = '0005'
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None

# Texto de partida para o profissional, por gatilho. Fica escrito aqui, e nao
# importado do codigo, para a migracao continuar a correr igual daqui a um ano.
TEXTOS_DO_PROFISSIONAL = [
    (
        "booking_requested",
        """Nova marcação pedida.

{cliente} — {telefone_cliente}
{servico} · {duracao} min · {preco}
{dia_semana}, {data} às {hora}

Código {codigo}. Confirme pelo painel.""",
    ),
    (
        "booking_confirmed",
        """Marcação confirmada: {cliente} — {servico}, {data} às {hora}.""",
    ),
    (
        "booking_completed",
        """Atendimento concluído: {cliente} — {servico}, {data} às {hora}. {preco}""",
    ),
    (
        "booking_no_show",
        """Falta: {cliente} — {telefone_cliente} não compareceu a {data} às {hora}.""",
    ),
    (
        "booking_cancelled",
        """Marcação cancelada.

{cliente} — {telefone_cliente}
{servico}, {data} às {hora}
{motivo}

A hora ficou livre na sua agenda.""",
    ),
    (
        "reminder_before",
        """A seguir: {cliente} — {telefone_cliente}, {servico} às {hora}.""",
    ),
    (
        "reminder_after",
        """Seguimento de {cliente} — {servico} de {data}. Vale a pena perguntar como correu.""",
    ),
]


def upgrade() -> None:
    # As colunas nascem com server_default: sem ele, o NOT NULL não teria valor
    # para as regras que já existem.
    op.add_column(
        "notification_rules",
        sa.Column("client_body", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "notification_rules",
        sa.Column("professional_body", sa.Text(), nullable=False, server_default=""),
    )

    # O texto que já existia era o do cliente: passa para lá em vez de se perder.
    # Quem tinha personalizado a mensagem mantém-na.
    op.execute("UPDATE notification_rules SET client_body = body WHERE body <> ''")

    # O texto para o profissional é novo, por isso vem com um valor de partida.
    # Fica escrito aqui e não importado do código: uma migração tem de continuar
    # a correr igual daqui a um ano, mesmo que os modelos mudem.
    for gatilho, texto in TEXTOS_DO_PROFISSIONAL:
        op.execute(
            sa.text(
                # trigger é um enum: sem o cast, o Postgres recusa a comparação
                # com texto ("operator does not exist").
                "UPDATE notification_rules SET professional_body = :texto "
                "WHERE trigger::text = :gatilho AND professional_body = ''"
            ).bindparams(texto=texto, gatilho=gatilho)
        )

    # Quem tinha o aviso desligado no canal fica com os destinatários desligados:
    # é a mesma intenção, expressa da forma nova.
    op.execute(
        "UPDATE notification_rules SET to_client = false, to_professional = false "
        "WHERE channels = 'none'"
    )

    op.drop_column("notification_rules", "body")
    op.drop_column("notification_rules", "subject")
    op.drop_column("notification_rules", "channels")

    # O tipo enum deixou de ter quem o use.
    op.execute("DROP TYPE IF EXISTS notification_channels")


def downgrade() -> None:
    op.execute(
        "CREATE TYPE notification_channels AS ENUM ('none', 'email', 'whatsapp', 'both')"
    )
    op.add_column(
        "notification_rules",
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column("notification_rules", sa.Column("subject", sa.String(200), nullable=True))
    op.add_column(
        "notification_rules",
        sa.Column(
            "channels",
            sa.Enum("none", "email", "whatsapp", "both", name="notification_channels"),
            nullable=False,
            server_default="whatsapp",
        ),
    )
    op.execute("UPDATE notification_rules SET body = client_body")
    op.execute(
        "UPDATE notification_rules SET channels = 'none' "
        "WHERE to_client = false AND to_professional = false"
    )
    op.drop_column("notification_rules", "professional_body")
    op.drop_column("notification_rules", "client_body")
