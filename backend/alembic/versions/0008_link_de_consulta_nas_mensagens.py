"""ligacao de consulta nas mensagens automaticas

Revision ID: 0008
Revises: 0007

O código sozinho não chegava: quem o recebia no WhatsApp ficava com um punhado
de letras e sem saber onde as escrever. Os modelos passam a levar a ligação.

Só se troca o texto de quem ainda tem o de origem — palavra por palavra. Um
profissional que tenha reescrito a mensagem dele fica com a dele.
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = '0008'
down_revision: str | None = '0007'
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


# (gatilho, texto antigo, texto novo). Escritos aqui e não importados do
# código, para a migração continuar a correr igual daqui a um ano.
TROCAS: list[tuple[str, str, str]] = [
    (
        "booking_requested",
        "Olá {cliente}, recebemos o seu pedido de marcação:\n"
        "{servico}, {dia_semana}, {data} às {hora}.\n\n"
        "Confirmo em breve. O código da marcação é {codigo}.\n\n"
        "{profissional}",
        "Olá {cliente}, recebemos o seu pedido de marcação:\n"
        "{servico}, {dia_semana}, {data} às {hora}.\n\n"
        "Confirmo em breve.\n\n"
        "Acompanhe aqui: {link_marcacao}\n"
        "Código {codigo}.\n\n"
        "{profissional}",
    ),
    (
        "booking_confirmed",
        "Olá {cliente}, a sua marcação está confirmada:\n"
        "{servico}, {dia_semana}, {data} às {hora}.\n"
        "Local: {morada}\n"
        "Valor: {preco}\n\n"
        "Se precisar de alterar alguma coisa, é só dizer.\n\n"
        "{profissional}",
        "Olá {cliente}, a sua marcação está confirmada:\n"
        "{servico}, {dia_semana}, {data} às {hora}.\n"
        "Local: {morada}\n"
        "Valor: {preco}\n\n"
        "Se precisar de alterar alguma coisa, é só dizer.\n\n"
        "Detalhes da marcação: {link_marcacao}\n\n"
        "{profissional}",
    ),
    (
        "booking_completed",
        "Olá {cliente}, obrigada por ter vindo. Espero que tenha gostado do resultado.\n\n"
        "Se quiser deixar a sua avaliação, use o código {codigo}.\n\n"
        "Até à próxima,\n{profissional}",
        "Olá {cliente}, obrigada por ter vindo. Espero que tenha gostado do resultado.\n\n"
        "Se quiser deixar a sua avaliação, é aqui: {link_marcacao}\n\n"
        "Até à próxima,\n{profissional}",
    ),
    (
        "reminder_before",
        "Olá {cliente}, passo só a lembrar: {servico} hoje às {hora}.\n"
        "Local: {morada}\n\n"
        "Até já,\n{profissional}",
        "Olá {cliente}, passo só a lembrar: {servico} hoje às {hora}.\n"
        "Local: {morada}\n\n"
        "Detalhes: {link_marcacao}\n\n"
        "Até já,\n{profissional}",
    ),
]


def _trocar(pares: list[tuple[str, str, str]]) -> None:
    conn = op.get_bind()
    for gatilho, de, para in pares:
        conn.execute(
            sa.text(
                "UPDATE notification_rules SET client_body = :para "
                "WHERE trigger::text = :gatilho AND client_body = :de"
            ),
            {"gatilho": gatilho, "de": de, "para": para},
        )


def upgrade() -> None:
    _trocar(TROCAS)


def downgrade() -> None:
    _trocar([(gatilho, para, de) for gatilho, de, para in TROCAS])
