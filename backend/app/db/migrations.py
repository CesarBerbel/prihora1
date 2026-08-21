"""Aplicacao das migrations, inclusive em bancos criados antes do Alembic."""

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect

from app.db.session import engine

logger = logging.getLogger("prihora.migrations")

# Revisao que representa o schema anterior a adocao do Alembic.
BASELINE_REVISION = "0001"


def _alembic_config() -> Config:
    root = Path(__file__).resolve().parents[2]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "alembic"))
    return config


def upgrade_database() -> None:
    """Leva o banco ate a ultima revisao.

    Instalacoes anteriores ao Alembic tem as tabelas mas nao tem controle de
    versao. Rodar as migrations do zero nelas quebraria em "ja existe"; entao,
    quando encontramos um banco com dados e sem historico, marcamos a baseline
    como aplicada e seguimos dali. Bancos vazios sobem tudo normalmente.
    """
    config = _alembic_config()
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    if "alembic_version" not in tables and "users" in tables:
        logger.info(
            "Banco anterior ao controle de versao. Adotando a baseline %s.",
            BASELINE_REVISION,
        )
        command.stamp(config, BASELINE_REVISION)

    command.upgrade(config, "head")
    logger.info("Migrations aplicadas.")


def current_revision() -> str | None:
    inspector = inspect(engine)
    if "alembic_version" not in inspector.get_table_names():
        return None
    with engine.connect() as conn:
        row = conn.exec_driver_sql("SELECT version_num FROM alembic_version").first()
    return row[0] if row else None
