"""Two-factor authentication: enabling, signing in, recovery and disabling."""

import pyotp

from app import email as mailer
from tests.conftest import current_session, last_code_for, login, register


def enable_2fa(client) -> tuple[str, list[str]]:
    """Runs the real setup dance. Returns the secret and the recovery codes."""
    secret = client.post("/api/v1/auth/2fa/setup").json()["secret"]
    res = client.post("/api/v1/auth/2fa/enable", json={"code": pyotp.TOTP(secret).now()})
    assert res.status_code == 200, res.text
    return secret, res.json()["codes"]


# --------------------------------------------------------------------------
# Enabling
# --------------------------------------------------------------------------

def test_setup_returns_something_an_authenticator_can_scan(client):
    register(client, "euan")
    login(client, "euan")

    body = client.post("/api/v1/auth/2fa/setup").json()
    assert body["secret"]
    assert body["otpauth_uri"].startswith("otpauth://totp/")
    assert "LifeExpanse" in body["otpauth_uri"]


def test_setup_alone_does_not_turn_2fa_on(client):
    """A mis-scanned QR must not lock the user out the moment they sign out."""
    register(client, "euan")
    login(client, "euan")
    client.post("/api/v1/auth/2fa/setup")

    assert client.get("/api/v1/auth/2fa/status").json()["enabled"] is False
    client.post("/api/v1/auth/logout")
    login(client, "euan")  # still just a password


def test_enabling_requires_a_working_code(client):
    register(client, "euan")
    login(client, "euan")
    client.post("/api/v1/auth/2fa/setup")

    res = client.post("/api/v1/auth/2fa/enable", json={"code": "000000"})
    assert res.status_code == 400
    assert client.get("/api/v1/auth/2fa/status").json()["enabled"] is False


def test_enabling_returns_recovery_codes(client):
    register(client, "euan")
    login(client, "euan")
    _, codes = enable_2fa(client)

    assert len(codes) == 10
    assert client.get("/api/v1/auth/2fa/status").json()["recovery_codes_left"] == 10


def test_recovery_codes_are_never_shown_again(client):
    register(client, "euan")
    login(client, "euan")
    _, codes = enable_2fa(client)

    # Nothing can reveal them: they are hashed on the way in.
    status = client.get("/api/v1/auth/2fa/status").json()
    assert "codes" not in status
    for code in codes:
        assert code not in str(status)


# --------------------------------------------------------------------------
# Signing in
# --------------------------------------------------------------------------

def test_password_alone_no_longer_signs_in(client):
    register(client, "euan")
    login(client, "euan")
    secret, _ = enable_2fa(client)
    client.post("/api/v1/auth/logout")

    res = client.post("/api/v1/auth/login", json={
        "credential": "euan", "password": "demo123456", "remember": True})
    assert res.status_code == 401
    assert res.headers.get("X-Requires-2FA") == "1"
    # And the refusal really is not a login.
    assert client.get("/api/v1/auth/me").status_code == 401


def test_signing_in_with_an_authenticator_code(client):
    register(client, "euan")
    login(client, "euan")
    secret, _ = enable_2fa(client)
    client.post("/api/v1/auth/logout")

    res = client.post("/api/v1/auth/login", json={
        "credential": "euan", "password": "demo123456", "remember": True,
        "totp_code": pyotp.TOTP(secret).now()})
    assert res.status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 200


def test_a_wrong_code_does_not_sign_in(client):
    register(client, "euan")
    login(client, "euan")
    enable_2fa(client)
    client.post("/api/v1/auth/logout")

    res = client.post("/api/v1/auth/login", json={
        "credential": "euan", "password": "demo123456", "remember": True,
        "totp_code": "000000"})
    assert res.status_code == 401
    assert client.get("/api/v1/auth/me").status_code == 401


# --------------------------------------------------------------------------
# Recovery codes — the reason a lost phone is not a lost account
# --------------------------------------------------------------------------

def test_a_recovery_code_gets_you_in(client):
    register(client, "euan")
    login(client, "euan")
    _, codes = enable_2fa(client)
    client.post("/api/v1/auth/logout")

    res = client.post("/api/v1/auth/login", json={
        "credential": "euan", "password": "demo123456", "remember": True,
        "totp_code": codes[0]})
    assert res.status_code == 200


def test_each_recovery_code_works_exactly_once(client):
    register(client, "euan")
    login(client, "euan")
    _, codes = enable_2fa(client)
    client.post("/api/v1/auth/logout")

    client.post("/api/v1/auth/login", json={
        "credential": "euan", "password": "demo123456", "remember": True,
        "totp_code": codes[0]})
    client.post("/api/v1/auth/logout")

    res = client.post("/api/v1/auth/login", json={
        "credential": "euan", "password": "demo123456", "remember": True,
        "totp_code": codes[0]})
    assert res.status_code == 401


def test_spending_a_recovery_code_reduces_the_count(client):
    register(client, "euan")
    login(client, "euan")
    _, codes = enable_2fa(client)
    client.post("/api/v1/auth/logout")

    client.post("/api/v1/auth/login", json={
        "credential": "euan", "password": "demo123456", "remember": True,
        "totp_code": codes[0]})
    assert client.get("/api/v1/auth/2fa/status").json()["recovery_codes_left"] == 9


def test_regenerating_invalidates_the_old_set(client):
    register(client, "euan")
    login(client, "euan")
    _, old = enable_2fa(client)

    fresh = client.post("/api/v1/auth/2fa/recovery-codes").json()["codes"]
    assert set(fresh) & set(old) == set()

    client.post("/api/v1/auth/logout")
    res = client.post("/api/v1/auth/login", json={
        "credential": "euan", "password": "demo123456", "remember": True,
        "totp_code": old[0]})
    assert res.status_code == 401


# --------------------------------------------------------------------------
# Disabling
# --------------------------------------------------------------------------

def test_disabling_needs_password_and_a_second_proof(client):
    register(client, "euan")
    login(client, "euan")
    secret, _ = enable_2fa(client)

    res = client.post("/api/v1/auth/2fa/disable", json={"current_password": "demo123456"})
    assert res.status_code == 400
    assert client.get("/api/v1/auth/2fa/status").json()["enabled"] is True


def test_disabling_with_the_authenticator(client):
    register(client, "euan")
    login(client, "euan")
    secret, _ = enable_2fa(client)

    res = client.post("/api/v1/auth/2fa/disable", json={
        "current_password": "demo123456", "totp_code": pyotp.TOTP(secret).now()})
    assert res.status_code == 200
    assert client.get("/api/v1/auth/2fa/status").json()["enabled"] is False


def test_disabling_clears_the_recovery_codes(client):
    """They stand in for the authenticator; with it gone they are a stray key."""
    register(client, "euan")
    login(client, "euan")
    secret, _ = enable_2fa(client)
    client.post("/api/v1/auth/2fa/disable", json={
        "current_password": "demo123456", "totp_code": pyotp.TOTP(secret).now()})

    assert client.get("/api/v1/auth/2fa/status").json()["recovery_codes_left"] == 0


def test_disabling_tells_the_owner(client):
    register(client, "euan")
    login(client, "euan")
    secret, _ = enable_2fa(client)
    client.post("/api/v1/auth/2fa/disable", json={
        "current_password": "demo123456", "totp_code": pyotp.TOTP(secret).now()})

    assert any("关闭两步验证" in m.subject for m in mailer.outbox)


def test_the_admin_may_not_switch_2fa_off(client):
    """An admin without 2FA is the most valuable target on the site."""
    from app.bootstrap import ensure_admin
    from app.security import hash_password
    from app import totp as tf

    with current_session() as db:
        admin = ensure_admin(db)
        admin.password_hash = hash_password("adminpass123")
        secret = tf.new_secret()
        tf.store_secret(admin, secret)
        admin.totp_enabled = True
        db.commit()

    client.post("/api/v1/auth/login", json={
        "credential": "AdminEuan", "password": "adminpass123", "remember": True,
        "totp_code": pyotp.TOTP(secret).now()})

    res = client.post("/api/v1/auth/2fa/disable", json={
        "current_password": "adminpass123", "totp_code": pyotp.TOTP(secret).now()})
    assert res.status_code == 403
    assert client.get("/api/v1/auth/2fa/status").json()["enabled"] is True


# --------------------------------------------------------------------------
# 2FA as the alternative to an unreachable email
# --------------------------------------------------------------------------

def test_2fa_can_stand_in_for_the_email_code_when_changing_a_password(client):
    register(client, "euan")
    login(client, "euan")
    secret, _ = enable_2fa(client)

    res = client.post("/api/v1/auth/password/change", json={
        "current_password": "demo123456", "new_password": "brandnew12345",
        "totp_code": pyotp.TOTP(secret).now()})
    assert res.status_code == 200

    client.post("/api/v1/auth/logout")
    res = client.post("/api/v1/auth/login", json={
        "credential": "euan", "password": "brandnew12345", "remember": True,
        "totp_code": pyotp.TOTP(secret).now()})
    assert res.status_code == 200


def test_the_email_route_still_works_when_2fa_is_on(client):
    register(client, "euan")
    login(client, "euan")
    enable_2fa(client)

    client.post("/api/v1/auth/step-up/code", params={"purpose": "change_password"})
    res = client.post("/api/v1/auth/password/change", json={
        "current_password": "demo123456", "new_password": "brandnew12345",
        "email_code": last_code_for("euan@example.com")})
    assert res.status_code == 200


def test_login_accepts_a_username_in_any_case(client):
    """Registration lower-cases usernames but the admin is created verbatim as
    "AdminEuan". An exact match against a lower-cased credential could never
    find it, so the admin could not sign in at all."""
    register(client, "euan")
    for typed in ("euan", "Euan", "EUAN", "  euan  "):
        res = client.post("/api/v1/auth/login", json={
            "credential": typed, "password": "demo123456", "remember": True})
        assert res.status_code == 200, typed
        client.post("/api/v1/auth/logout")


def test_the_admin_can_sign_in(client):
    from app.bootstrap import ensure_admin
    from app.security import hash_password

    with current_session() as db:
        admin = ensure_admin(db)
        admin.password_hash = hash_password("adminpass123")
        db.commit()

    res = client.post("/api/v1/auth/login", json={
        "credential": "AdminEuan", "password": "adminpass123", "remember": True})
    assert res.status_code == 200
    assert client.get("/api/v1/auth/me").json()["role"] == "admin"
