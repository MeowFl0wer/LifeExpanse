from collections.abc import Generator
from pathlib import Path

from sqlalchemy import MetaData, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings

# SQLite cannot ALTER a constraint in place, so Alembic rewrites the table
# ("batch mode") — and to do that it must be able to name every constraint.
# Unnamed ones make a migration fail with "Constraint must have a name" the
# first time a column with a foreign key is added to an existing table.
#
# Setting a convention here means names are assigned consistently from the
# start, rather than discovered to be missing during a deployment.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


def _make_engine():
    settings = get_settings()
    url = settings.database_url
    if url.startswith("sqlite:///") and ":memory:" not in url:
        Path(url.replace("sqlite:///", "")).parent.mkdir(parents=True, exist_ok=True)
    # check_same_thread is a SQLite-only concession to FastAPI's threadpool.
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, connect_args=connect_args, pool_pre_ping=True)


engine = _make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
