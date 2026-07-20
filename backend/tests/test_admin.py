"""The admin console: access, system status, users, settings, invites, audit."""

import pyotp

from tests.conftest import current_session, login, make_content, register


def sign_in_as_admin(client, with_2fa: bool = False) -> str | None:
    """Bootstraps the admin, gives it a known password, and signs in."""
    from app import totp as tf
    from app.bootstrap import ensure_admin
    from app.security import hash_password

    secret = None
    with current_session() as db:
        admin = ensure_admin(db)
        admin.password_hash = hash_password("adminpass123")
        if with_2fa:
            secret = tf.new_secret()
            tf.store_secret(admin, secret)
            admin.totp_enabled = True
        db.commit()

    body = {"credential": "AdminEuan", "password": "adminpass123", "remember": True}
    if secret:
        body["totp_code"] = pyotp.TOTP(secret).now()
    res = client.post("/api/v1/auth/login", json=body)
    assert res.status_code == 200, res.text
    return secret


# --------------------------------------------------------------------------
# Access
# --------------------------------------------------------------------------

def test_a_guest_gets_nothing(client):
    assert client.get("/api/v1/admin/status").status_code == 401


def test_an_ordinary_user_is_told_the_page_does_not_exist(client):
    """A 403 would confirm the console is there. A 404 says nothing."""
    register(client, "euan")
    login(client, "euan")

    for path in ("/api/v1/admin/status", "/api/v1/admin/users", "/api/v1/admin/audit"):
        res = client.get(path)
        assert res.status_code == 404, path


def test_the_site_owner_is_not_an_admin(client):
    """`euan` is the site owner but an ordinary account (需求 3.1)."""
    register(client, "euan")
    login(client, "euan")
    assert client.get("/api/v1/auth/me").json()["role"] == "user"
    assert client.get("/api/v1/admin/users").status_code == 404


def test_the_admin_gets_in(client):
    sign_in_as_admin(client)
    assert client.get("/api/v1/admin/status").status_code == 200


# --------------------------------------------------------------------------
# System status
# --------------------------------------------------------------------------

def test_status_reports_the_system(client):
    sign_in_as_admin(client)
    body = client.get("/api/v1/admin/status").json()

    assert body["uptime_seconds"] >= 0
    assert len(body["load_average"]) == 3
    assert body["registration_mode"] in ("closed", "invite", "open")
    assert body["cpu_count"] >= 1


def test_status_counts_users_and_content(client):
    register(client, "euan")
    login(client, "euan")
    make_content(client)
    make_content(client, title="第二篇")
    client.post("/api/v1/auth/logout")

    sign_in_as_admin(client)
    body = client.get("/api/v1/admin/status").json()
    # The admin itself is not counted as a user of the site.
    assert body["total_users"] == 1
    assert body["total_contents"] == 2


# --------------------------------------------------------------------------
# User list
# --------------------------------------------------------------------------

def test_the_admin_is_not_listed_among_the_users(client):
    register(client, "euan")
    sign_in_as_admin(client)

    names = [u["username"] for u in client.get("/api/v1/admin/users").json()]
    assert "euan" in names
    assert "AdminEuan" not in names


def test_the_list_masks_email_addresses(client):
    register(client, "euan")
    sign_in_as_admin(client)

    row = client.get("/api/v1/admin/users").json()[0]
    assert row["email_masked"] == "e***n@example.com"
    assert "euan@example.com" not in str(row)


def test_sorting_by_login_count(client):
    register(client, "alice")
    register(client, "bob")
    for _ in range(3):
        login(client, "bob")
        client.post("/api/v1/auth/logout")
    login(client, "alice")
    client.post("/api/v1/auth/logout")

    sign_in_as_admin(client)
    rows = client.get("/api/v1/admin/users", params={"sort": "login_count"}).json()
    assert [r["username"] for r in rows] == ["bob", "alice"]


def test_sorting_by_last_login(client):
    register(client, "alice")
    register(client, "bob")
    login(client, "alice")
    client.post("/api/v1/auth/logout")
    login(client, "bob")
    client.post("/api/v1/auth/logout")

    sign_in_as_admin(client)
    rows = client.get("/api/v1/admin/users", params={"sort": "last_login"}).json()
    assert rows[0]["username"] == "bob"


def test_sorting_by_registration_date(client):
    register(client, "alice")
    register(client, "bob")
    sign_in_as_admin(client)

    rows = client.get("/api/v1/admin/users", params={"sort": "created"}).json()
    assert [r["username"] for r in rows] == ["bob", "alice"]


def test_searching_the_user_list(client):
    register(client, "alice")
    register(client, "bob")
    sign_in_as_admin(client)

    rows = client.get("/api/v1/admin/users", params={"keyword": "ali"}).json()
    assert [r["username"] for r in rows] == ["alice"]


# --------------------------------------------------------------------------
# User detail
# --------------------------------------------------------------------------

def test_detail_counts_content_without_revealing_it(client):
    register(client, "euan")
    login(client, "euan")
    make_content(client, title="公开笔记", visibility="public")
    make_content(client, title="私密日记标题", visibility="private", type="diary", content_kind=None)
    client.post("/api/v1/auth/logout")

    sign_in_as_admin(client)
    user_id = client.get("/api/v1/admin/users").json()[0]["id"]
    body = client.get(f"/api/v1/admin/users/{user_id}").json()

    assert body["content_counts"]["total"] == 2
    assert body["content_counts"]["public"] == 1
    # The console manages accounts; it is not a reader. No titles, no bodies.
    assert "私密日记标题" not in str(body)
    assert "公开笔记" not in str(body)


def test_detail_refuses_to_describe_the_admin(client):
    sign_in_as_admin(client)
    with current_session() as db:
        from app.models import User
        admin_id = db.query(User).filter(User.username == "AdminEuan").one().id

    assert client.get(f"/api/v1/admin/users/{admin_id}").status_code == 404


# --------------------------------------------------------------------------
# Permissions
# --------------------------------------------------------------------------

def test_granting_video_upload(client):
    register(client, "euan")
    sign_in_as_admin(client)
    user_id = client.get("/api/v1/admin/users").json()[0]["id"]

    res = client.patch(
        f"/api/v1/admin/users/{user_id}/permissions", params={"can_upload_video": True}
    )
    assert res.status_code == 200
    assert res.json()["can_upload_video"] is True
    # Untouched fields stay as they were.
    assert res.json()["can_upload_image"] is True


def test_permission_changes_are_audited(client):
    register(client, "euan")
    sign_in_as_admin(client)
    user_id = client.get("/api/v1/admin/users").json()[0]["id"]
    client.patch(f"/api/v1/admin/users/{user_id}/permissions", params={"can_upload_video": True})

    events = client.get("/api/v1/admin/audit", params={"event": "permissions_changed"}).json()
    assert events, "granting rights left no trace"
    assert events[0]["actor"] == "AdminEuan"
    assert "can_upload_video=True" in events[0]["detail"]
    assert "euan" in events[0]["detail"]


def test_an_ordinary_user_cannot_grant_themselves_anything(client):
    register(client, "euan")
    sign_in_as_admin(client)
    user_id = client.get("/api/v1/admin/users").json()[0]["id"]
    client.post("/api/v1/auth/logout")

    login(client, "euan")
    res = client.patch(
        f"/api/v1/admin/users/{user_id}/permissions", params={"can_upload_video": True}
    )
    assert res.status_code == 404
    assert client.get("/api/v1/auth/me").json()["can_upload_video"] is False


def test_deactivating_a_user_stops_them_signing_in(client):
    register(client, "euan")
    sign_in_as_admin(client)
    user_id = client.get("/api/v1/admin/users").json()[0]["id"]
    client.patch(f"/api/v1/admin/users/{user_id}/permissions", params={"is_active": False})
    client.post("/api/v1/auth/logout")

    res = client.post("/api/v1/auth/login", json={
        "credential": "euan", "password": "demo123456", "remember": True})
    assert res.status_code == 401


# --------------------------------------------------------------------------
# Registration mode
# --------------------------------------------------------------------------

def test_switching_registration_mode_takes_effect_at_once(client):
    sign_in_as_admin(client)
    client.patch("/api/v1/admin/settings/registration-mode", params={"mode": "closed"})
    client.post("/api/v1/auth/logout")

    res = client.post("/api/v1/auth/register/code", json={"email": "new@example.com"})
    assert res.status_code == 403


def test_invite_mode_requires_a_code(client):
    sign_in_as_admin(client)
    client.patch("/api/v1/admin/settings/registration-mode", params={"mode": "invite"})
    client.post("/api/v1/auth/logout")

    client.post("/api/v1/auth/register/code", json={"email": "new@example.com"})
    res = client.post("/api/v1/auth/register", json={
        "username": "newbie", "email": "new@example.com",
        "password": "demo123456", "code": "000000"})
    assert res.status_code == 400
    assert "邀请码" in res.json()["detail"]


def test_mode_changes_are_audited(client):
    sign_in_as_admin(client)
    client.patch("/api/v1/admin/settings/registration-mode", params={"mode": "open"})

    events = client.get(
        "/api/v1/admin/audit", params={"event": "registration_mode_changed"}
    ).json()
    assert events
    assert "→ open" in events[0]["detail"]


# --------------------------------------------------------------------------
# Invite codes
# --------------------------------------------------------------------------

def test_an_invite_lets_exactly_one_person_in(client):
    from tests.conftest import last_code_for

    sign_in_as_admin(client)
    client.patch("/api/v1/admin/settings/registration-mode", params={"mode": "invite"})
    code = client.post("/api/v1/admin/invites", params={"note": "给朋友"}).json()["code"]
    client.post("/api/v1/auth/logout")

    client.post("/api/v1/auth/register/code", json={"email": "first@example.com"})
    first = client.post("/api/v1/auth/register", json={
        "username": "firstie", "email": "first@example.com", "password": "demo123456",
        "code": last_code_for("first@example.com"), "invite_code": code})
    assert first.status_code == 201

    client.post("/api/v1/auth/register/code", json={"email": "second@example.com"})
    second = client.post("/api/v1/auth/register", json={
        "username": "secondie", "email": "second@example.com", "password": "demo123456",
        "code": last_code_for("second@example.com"), "invite_code": code})
    assert second.status_code == 400


def test_a_revoked_invite_no_longer_works(client):
    from tests.conftest import last_code_for

    sign_in_as_admin(client)
    client.patch("/api/v1/admin/settings/registration-mode", params={"mode": "invite"})
    invite = client.post("/api/v1/admin/invites").json()
    client.delete(f"/api/v1/admin/invites/{invite['id']}")
    client.post("/api/v1/auth/logout")

    client.post("/api/v1/auth/register/code", json={"email": "new@example.com"})
    res = client.post("/api/v1/auth/register", json={
        "username": "newbie", "email": "new@example.com", "password": "demo123456",
        "code": last_code_for("new@example.com"), "invite_code": invite["code"]})
    assert res.status_code == 400


def test_a_spent_invite_cannot_be_revoked(client):
    from tests.conftest import last_code_for

    sign_in_as_admin(client)
    client.patch("/api/v1/admin/settings/registration-mode", params={"mode": "invite"})
    invite = client.post("/api/v1/admin/invites").json()
    client.post("/api/v1/auth/logout")

    client.post("/api/v1/auth/register/code", json={"email": "new@example.com"})
    client.post("/api/v1/auth/register", json={
        "username": "newbie", "email": "new@example.com", "password": "demo123456",
        "code": last_code_for("new@example.com"), "invite_code": invite["code"]})

    sign_in_as_admin(client)
    assert client.delete(f"/api/v1/admin/invites/{invite['id']}").status_code == 400


def test_the_invite_list_shows_who_used_it(client):
    from tests.conftest import last_code_for

    sign_in_as_admin(client)
    client.patch("/api/v1/admin/settings/registration-mode", params={"mode": "invite"})
    invite = client.post("/api/v1/admin/invites").json()
    client.post("/api/v1/auth/logout")

    client.post("/api/v1/auth/register/code", json={"email": "new@example.com"})
    client.post("/api/v1/auth/register", json={
        "username": "newbie", "email": "new@example.com", "password": "demo123456",
        "code": last_code_for("new@example.com"), "invite_code": invite["code"]})

    sign_in_as_admin(client)
    row = client.get("/api/v1/admin/invites").json()[0]
    assert row["used_by"] == "newbie"
    assert row["spent"] is True


# --------------------------------------------------------------------------
# Audit log
# --------------------------------------------------------------------------

def test_the_audit_log_records_sign_ins(client):
    register(client, "euan")
    login(client, "euan")
    client.post("/api/v1/auth/logout")

    sign_in_as_admin(client)
    events = client.get("/api/v1/admin/audit", params={"event": "login"}).json()
    assert any(e["actor"] == "euan" for e in events)


def test_the_audit_log_is_newest_first(client):
    sign_in_as_admin(client)
    client.patch("/api/v1/admin/settings/registration-mode", params={"mode": "open"})
    client.patch("/api/v1/admin/settings/registration-mode", params={"mode": "closed"})

    events = client.get(
        "/api/v1/admin/audit", params={"event": "registration_mode_changed"}
    ).json()
    assert "→ closed" in events[0]["detail"]
    assert "→ open" in events[1]["detail"]


def test_detail_counts_media_without_revealing_it(client):
    import io

    register(client, "euan")
    login(client, "euan")
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
    client.post("/api/v1/media", files={"file": ("secret-holiday-photo.png", io.BytesIO(png), "image/png")})
    client.post("/api/v1/auth/logout")

    sign_in_as_admin(client)
    user_id = client.get("/api/v1/admin/users").json()[0]["id"]
    body = client.get(f"/api/v1/admin/users/{user_id}").json()

    assert body["media_counts"]["images"] == 1
    assert body["media_counts"]["bytes"] == len(png)
    # How much space, never what it is.
    assert "secret-holiday-photo" not in str(body)
