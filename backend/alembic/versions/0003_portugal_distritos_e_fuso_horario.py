"""portugal: distritos e fuso horario

Revision ID: 0003
Revises: 0002
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = '0003'
down_revision: str | None = '0002'
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    # Distritos portugueses são nomes por extenso: "Lisboa", "Vila Real",
    # "Castelo Branco". Não cabem no VARCHAR(2) herdado das siglas de estado.
    op.alter_column(
        "cities", "state",
        existing_type=sa.VARCHAR(length=2), type_=sa.String(length=60),
        existing_nullable=False,
    )
    op.alter_column(
        "professionals", "state",
        existing_type=sa.VARCHAR(length=2), type_=sa.String(length=60),
        existing_nullable=True,
    )

    # Perfis criados antes da mudança ficaram com o fuso do Brasil. Como a
    # agenda é calculada nesse fuso, deixá-los assim deslocaria os horários.
    op.execute(
        "UPDATE professionals SET timezone = 'Europe/Lisbon' "
        "WHERE timezone = 'America/Sao_Paulo'"
    )

    # Duas categorias tinham nome do português do Brasil. Renomear o slug em
    # vez de criar categorias novas preserva os vínculos já existentes.
    op.execute("UPDATE categories SET slug = 'pestanas', name = 'Pestanas' WHERE slug = 'cilios'")
    op.execute(
        "UPDATE categories SET slug = 'maquilhagem', name = 'Maquilhagem' "
        "WHERE slug = 'maquiagem'"
    )

    # O administrador semeado muda de domínio junto com o resto. Renomear antes
    # da limpeza abaixo evita que ele seja apagado como conta de exemplo.
    op.execute(
        """
        UPDATE users SET email = 'admin@prihora.pt'
        WHERE email = 'admin@prihora.com.br'
          AND NOT EXISTS (SELECT 1 FROM users u2 WHERE u2.email = 'admin@prihora.pt')
        """
    )

    # Os perfis de demonstração brasileiros dão lugar aos portugueses. Como o
    # seed é idempotente, sem esta limpeza os dois conjuntos ficariam lado a
    # lado. Só saem contas @prihora.com.br, que sempre foram de exemplo; perfis
    # criados por quem usa o sistema não são tocados.
    op.execute("DELETE FROM users WHERE email LIKE '%@prihora.com.br'")


def downgrade() -> None:
    op.execute(
        "UPDATE professionals SET timezone = 'America/Sao_Paulo' "
        "WHERE timezone = 'Europe/Lisbon'"
    )
    # Truncar para dois caracteres perderia o nome do distrito; por isso a
    # volta atrás só desfaz o que dá para desfazer sem destruir dados.
    op.alter_column(
        "professionals", "state",
        existing_type=sa.String(length=60), type_=sa.String(length=60),
        existing_nullable=True,
    )
