from tests.conftest import login, logout, register


def test_register_and_login(client):
    register(client, "euan")
    login(client, "euan")
    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["username"] == "euan"


def test_password_is_not_stored_in_plain(client):
    from app.db import get_db
    from app.main import app
    register(client, "euan")
    db = next(app.dependency_overrides[get_db]())
    from app.models import User
    from sqlalchemy import select
    user = db.scalar(select(User).where(User.username == "euan"))
    assert "demo123456" not in user.password_hash
    assert user.password_hash.startswith("$argon2")


def test_wrong_password_is_rejected(client):
    register(client, "euan")
    res = client.post("/api/v1/auth/login", json={
        "credential": "euan", "password": "wrong-password", "remember": False,
    })
    assert res.status_code == 401


# The same message either way, so it cannot be used to discover which
# usernames exist.
def test_unknown_user_and_wrong_password_look_identical(client):
    register(client, "euan")
    unknown = client.post("/api/v1/auth/login", json={
        "credential": "nobody", "password": "demo123456", "remember": False})
    wrong = client.post("/api/v1/auth/login", json={
        "credential": "euan", "password": "nope12345", "remember": False})
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json()["detail"] == wrong.json()["detail"]


def test_me_requires_a_session(client):
    assert client.get("/api/v1/auth/me").status_code == 401


def test_logout_ends_the_session(client):
    register(client, "euan")
    login(client, "euan")
    logout(client)
    assert client.get("/api/v1/auth/me").status_code == 401


def test_reserved_usernames_are_refused(client):
    res = client.post("/api/v1/auth/register", json={
        "username": "admin", "email": "a@example.com", "password": "demo123456"})
    assert res.status_code == 400


def test_duplicate_username_is_refused(client):
    register(client, "euan")
    res = client.post("/api/v1/auth/register", json={
        "username": "euan", "email": "other@example.com", "password": "demo123456"})
    assert res.status_code == 409
