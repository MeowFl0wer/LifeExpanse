import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Must be set before the app imports its settings.
os.environ["LIFE_DATABASE_URL"] = "sqlite://"
os.environ["LIFE_REGISTRATION_MODE"] = "open"
os.environ["LIFE_SECRET_KEY"] = "test-secret"

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.db import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402


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

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


def register(client, username: str, password: str = "demo123456") -> dict:
    res = client.post("/api/v1/auth/register", json={
        "username": username, "email": f"{username}@example.com",
        "password": password, "display_name": username.title(),
    })
    assert res.status_code == 201, res.text
    return res.json()


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
