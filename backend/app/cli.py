"""CLI de manutencao do prihora.

    python -m app.cli init      aplica as migrations e popula os dados iniciais
    python -m app.cli migrate   apenas aplica as migrations
    python -m app.cli seed      apenas repopula os dados
    python -m app.cli wait      aguarda o banco aceitar conexoes
    python -m app.cli reset     DERRUBA e recria todas as tabelas
    python -m app.cli reminders aplica os lembretes devidos e sai
    python -m app.cli worker    fica a aplicar os lembretes de minuto a minuto
"""

import logging
import sys
import time

from sqlalchemy import text
from sqlalchemy.exc import OperationalError

import app.models  # noqa: F401  (registra o metadata completo)
from app.db.migrations import current_revision, upgrade_database
from app.db.session import Base, SessionLocal, engine
from app.seed.run import run_seed
from app.services.reminders import run_once

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger("prihora.cli")


def wait_for_db(retries: int = 60, delay: float = 1.0) -> None:
    """O compose ja usa healthcheck, mas o retry cobre o restart do container."""
    for attempt in range(1, retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("Banco disponivel.")
            return
        except OperationalError:
            if attempt == retries:
                raise
            logger.info("Aguardando o banco... (%s/%s)", attempt, retries)
            time.sleep(delay)


def migrate() -> None:
    upgrade_database()
    logger.info("Banco na revisao %s.", current_revision())


def seed() -> None:
    with SessionLocal() as db:
        run_seed(db)


def reminders() -> int:
    with SessionLocal() as db:
        return run_once(db)


def wait_for_schema(retries: int = 60, delay: float = 2.0) -> None:
    """Espera que as migrations tenham corrido.

    O trabalhador sobe ao mesmo tempo que tudo o resto e pode chegar antes de a
    aplicação ter migrado a base. Esperar aqui evita uma primeira volta a falhar
    com um erro que não é problema nenhum.
    """
    from sqlalchemy import inspect

    for tentativa in range(1, retries + 1):
        if "notification_rules" in set(inspect(engine).get_table_names()):
            return
        if tentativa == 1:
            logger.info("À espera de que o schema esteja aplicado...")
        time.sleep(delay)
    logger.warning("O schema continua incompleto; a começar mesmo assim.")


def worker(intervalo: float = 60.0) -> None:
    """Fica a correr, à procura de lembretes devidos.

    Um processo à parte do que serve pedidos: assim o envio não compete com o
    tráfego do site, e uma falha aqui não derruba a aplicação.
    """
    wait_for_schema()
    logger.info("Trabalhador de lembretes no ar (a cada %ss).", int(intervalo))
    while True:
        try:
            enviadas = reminders()
            if enviadas:
                logger.info("%s lembrete(s) enviado(s).", enviadas)
        except Exception:
            # Uma volta falhada não pode matar o processo: tenta outra vez.
            logger.exception("Falha ao processar lembretes")
        time.sleep(intervalo)


def drop_schema() -> None:
    Base.metadata.drop_all(bind=engine)
    # O drop_all nao conhece a tabela de controle do Alembic. Se ela ficar para
    # tras, a proxima migration acha que ja rodou e deixa o banco vazio.
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS alembic_version"))
    logger.info("Tabelas removidas.")


def main(argv: list[str]) -> int:
    command = argv[1] if len(argv) > 1 else "init"

    if command == "wait":
        wait_for_db()
    elif command == "init":
        wait_for_db()
        migrate()
        seed()
        logger.info("prihora pronto para uso.")
    elif command == "migrate":
        wait_for_db()
        migrate()
    elif command == "seed":
        wait_for_db()
        seed()
    elif command == "reminders":
        wait_for_db()
        logger.info("Lembretes enviados: %s", reminders())
    elif command == "worker":
        wait_for_db()
        worker(float(argv[2]) if len(argv) > 2 else 60.0)
    elif command == "reset":
        wait_for_db()
        drop_schema()
        migrate()
        seed()
        logger.info("Banco recriado do zero.")
    else:
        print(__doc__)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
