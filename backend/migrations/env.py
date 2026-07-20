from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import get_settings
from app.db import Base

# Importing the models is what registers every table on Base.metadata. Without
# it `--autogenerate` would see an empty schema and cheerfully propose dropping
# the entire database.
import app.models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    # `disable_existing_loggers` defaults to True, which would switch off every
    # logger already set up — including uvicorn's and the app's. Migrations run
    # inside the application at startup, so that silently killed all logging
    # for the rest of the process, verification codes included.
    fileConfig(config.config_file_name, disable_existing_loggers=False)

# The URL comes from the application settings rather than alembic.ini, so a
# migration always runs against the same database the app itself uses.
config.set_main_option("sqlalchemy.url", get_settings().database_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Emits SQL to stdout without connecting — useful for reviewing a change."""
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # SQLite cannot ALTER most things in place; batch mode rewrites the
        # table instead. Without it almost every column change fails.
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def _configure_and_run(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        render_as_batch=True,
        # Without these two, a column changing type or default is silently
        # ignored by autogenerate.
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # The application hands us its own live connection when it migrates at
    # startup (see app/migrate.py). Building a second engine here would point at a
    # different connection — and for in-memory SQLite, a different database.
    existing = config.attributes.get("connection")
    if existing is not None:
        _configure_and_run(existing)
        return

    # Standalone use: `alembic upgrade head` from the command line.
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        _configure_and_run(connection)


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
