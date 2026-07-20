import os
import shutil
import sys
from contextlib import contextmanager
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Must be set before the app imports its settings.
os.environ["LIFE_DATABASE_URL"] = "sqlite://"
os.environ["LIFE_REGISTRATION_MODE"] = "open"
os.environ["LIFE_SECRET_KEY"] = "test-secret"

import tempfile  # noqa: E402
_MEDIA_DIR = tempfile.mkdtemp(prefix="lifeexpanse-test-media-")
os.environ["LIFE_MEDIA_ROOT"] = _MEDIA_DIR

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.db import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402


_TestingSession = None


@contextmanager
def current_session():
    """A session on the database the active `client` fixture is using."""
    assert _TestingSession is not None, "current_session() needs the client fixture"
    db = _TestingSession()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def client():
    # One in-memory database shared by every connection in the test, dropped
    # afterwards so tests cannot leak into each other.
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    # Exposed so a test can inspect rows directly, for state the API does not
    # return (login counts, roles).
    global _TestingSession
    _TestingSession = TestingSession

    # Background tasks open their own session on the application engine, which
    # in tests is a *different* in-memory database — a fresh one per thread.
    # Pointing the factory at the test engine is what makes a background task
    # see the same rows the request just wrote.
    from app import thumbnails
    thumbnails.SessionLocal = TestingSession

    app.dependency_overrides[get_db] = override_get_db

    # Each test starts with an empty inbox, so `last_code_for` cannot pick up
    # a code left behind by a previous test.
    from app import email as mailer
    mailer.outbox.clear()

    # Uploaded bytes are real files; each test starts with an empty directory
    # so quota and listing assertions cannot inherit another test's uploads.
    shutil.rmtree(_MEDIA_DIR, ignore_errors=True)
    Path(_MEDIA_DIR).mkdir(parents=True, exist_ok=True)

    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    mailer.outbox.clear()
    shutil.rmtree(_MEDIA_DIR, ignore_errors=True)
    Base.metadata.drop_all(bind=engine)


def register(
    client, username: str, password: str = "demo123456", email: str | None = None
) -> dict:
    """Registers through the real flow, including the emailed code.

    The console email backend keeps every message in `mailer.outbox`, so the
    test reads the code the same way a person would read their inbox — no
    back door into the code table.
    """
    address = email or f"{username}@example.com"
    res = client.post("/api/v1/auth/register/code", json={"email": address})
    assert res.status_code == 200, res.text

    res = client.post("/api/v1/auth/register", json={
        "username": username, "email": address,
        "password": password, "display_name": username.title(),
        "code": last_code_for(address),
    })
    assert res.status_code == 201, res.text
    return res.json()


def last_code_for(address: str) -> str:
    """Digs the most recent verification code out of the console outbox."""
    from app import email as mailer

    for message in reversed(mailer.outbox):
        if message.to == address.lower() and "验证码" in message.subject:
            return message.subject.split("：")[-1].strip()
    raise AssertionError(f"no verification code was sent to {address}")


def login(client, username: str, password: str = "demo123456") -> None:
    res = client.post("/api/v1/auth/login", json={
        "credential": username, "password": password, "remember": True,
    })
    assert res.status_code == 200, res.text


def logout(client) -> None:
    client.post("/api/v1/auth/logout")


def make_content(client, **overrides) -> dict:
    payload = {
        "type": "pkm", "content_kind": "note", "title": "测试笔记",
        "body": "正文", "visibility": "public", "tags": [],
        "folder_ids": [], "series_ids": [],
    }
    payload.update(overrides)
    res = client.post("/api/v1/content", json=payload)
    assert res.status_code == 201, res.text
    return res.json()
