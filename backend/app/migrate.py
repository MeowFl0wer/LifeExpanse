from __future__ import annotations

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config

from .config import get_settings
from .db import engine

log = logging.getLogger("lifeexpanse.migrate")

BACKEND_ROOT = Path(__file__).resolve().parent.parent


def alembic_config() -> Config:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "migrations"))
    # The URL always comes from application settings, never from alembic.ini,
    # so the migration and the app can never point at different databases.
    config.set_main_option("sqlalchemy.url", get_settings().database_url)
    return config


def run_migrations() -> None:
    """Brings the database up to the latest revision.

    Safe to call on every boot: Alembic applies only the revisions the database
    has not seen. On a brand new database that means the whole schema.

    The upgrade runs on the **application's own engine**, handed to Alembic as
    an open connection. Letting Alembic build its own would give it a separate
    connection — and for an in-memory SQLite database that is a separate
    database entirely, so the migration would land somewhere the app never
    looks. Sharing the engine makes that impossible by construction.
    """
    url = get_settings().database_url
    if url.startswith("sqlite:///") and ":memory:" not in url:
        Path(url.removeprefix("sqlite:///")).parent.mkdir(parents=True, exist_ok=True)

    config = alembic_config()
    log.info("applying database migrations")
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
