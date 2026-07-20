"""The backup email: binding it, signing in with it, recovering through it.

A backup address is a second door into the account. Everything here follows
from that: binding needs the same proof as changing the primary, the address
must be unique across the whole table, and the primary is told when one
appears.
"""

import pyotp

from app import email as mailer
from tests.conftest import current_session, last_code_for, login, register


def bind_backup(client, address: str, password: str = "demo123456"):
    """Runs the real two-code flow: prove the owner, prove the new address."""
    client.post("/api/v1/auth/step-up/code", params={"purpose": "change_email"})
    owner_code = last_code_for("euan@example.com")

    client.post("/api/v1/auth/email/backup/code", json={"email": address})
    return client.post("/api/v1/auth/email/backup", json={
        "current_password": password,
        "backup_email": address,
        "backup_email_code": last_code_for(address),
        "email_code": owner_code,
    })


# --------------------------------------------------------------------------
# Binding
# --------------------------------------------------------------------------

def test_binding_a_backup_address(client):
    register(client, "euan")
    login(client, "euan")

    assert bind_backup(client, "spare@example.com").status_code == 200
    me = client.get("/api/v1/auth/me").json()
    assert me["backup_email"] == "spare@example.com"
    assert me["backup_email_verified"] is True


def test_binding_needs_the_current_password(client):
    register(client, "euan")
    login(client, "euan")

    res = bind_backup(client, "spare@example.com", password="wrongwrong")
    assert res.status_code == 400
    assert client.get("/api/v1/auth/me").json()["backup_email"] is None


def test_binding_needs_a_second_proof(client):
    register(client, "euan")
    login(client, "euan")
    client.post("/api/v1/auth/email/backup/code", json={"email": "spare@example.com"})

    res = client.post("/api/v1/auth/email/backup", json={
        "current_password": "demo123456",
        "backup_email": "spare@example.com",
        "backup_email_code": last_code_for("spare@example.com"),
    })
    assert res.status_code == 400
    assert client.get("/api/v1/auth/me").json()["backup_email"] is None


def test_binding_needs_the_new_address_to_prove_itself(client):
    register(client, "euan")
    login(client, "euan")
    client.post("/api/v1/auth/step-up/code", params={"purpose": "change_email"})

    res = client.post("/api/v1/auth/email/backup", json={
        "current_password": "demo123456",
        "backup_email": "spare@example.com",
        "backup_email_code": "000000",
        "email_code": last_code_for("euan@example.com"),
    })
    assert res.status_code == 400


def test_the_backup_cannot_be_the_primary(client):
    register(client, "euan")
    login(client, "euan")

    res = bind_backup(client, "euan@example.com")
    assert res.status_code == 400


def test_no_code_is_sent_for_an_address_that_is_taken(client):
    register(client, "alice")
    register(client, "euan")
    login(client, "euan")
    mailer.outbox.clear()

    res = client.post("/api/v1/auth/email/backup/code", json={"email": "alice@example.com"})
    # Same neutral answer as for a free address…
    assert res.status_code == 200
    # …but nothing is actually sent.
    assert not [m for m in mailer.outbox if "验证码" in m.subject]


def test_the_backup_cannot_be_somebody_else_s_address(client):
    """One address, one account — otherwise recovery becomes ambiguous.

    Set up as a race: the code is issued while the address is still free, and
    somebody claims it before the binding is submitted. That is the only way
    to reach the uniqueness check, since the code endpoint refuses to send for
    an address already in use.
    """
    register(client, "alice")
    register(client, "euan")
    login(client, "euan")

    client.post("/api/v1/auth/step-up/code", params={"purpose": "change_email"})
    owner_code = last_code_for("euan@example.com")
    client.post("/api/v1/auth/email/backup/code", json={"email": "spare@example.com"})
    backup_code = last_code_for("spare@example.com")

    # Alice grabs it in the meantime.
    with current_session() as db:
        from app.models import User
        alice = db.query(User).filter(User.username == "alice").one()
        alice.email = "spare@example.com"
        db.commit()

    res = client.post("/api/v1/auth/email/backup", json={
        "current_password": "demo123456",
        "backup_email": "spare@example.com",
        "backup_email_code": backup_code,
        "email_code": owner_code,
    })
    assert res.status_code == 400
    assert client.get("/api/v1/auth/me").json()["backup_email"] is None


def test_the_primary_is_told_a_backup_appeared(client):
    register(client, "euan")
    login(client, "euan")
    mailer.outbox.clear()
    bind_backup(client, "spare@example.com")

    notices = [m for m in mailer.outbox if "绑定备用邮箱" in m.subject]
    assert notices, "a new way into the account appeared silently"
    assert notices[-1].to == "euan@example.com"
    # And it does not hand the new address to whoever reads that inbox.
    assert "spare@example.com" not in notices[-1].body
    assert "s***e@example.com" in notices[-1].body


def test_2fa_can_stand_in_for_the_email_proof(client):
    register(client, "euan")
    login(client, "euan")
    secret = client.post("/api/v1/auth/2fa/setup").json()["secret"]
    client.post("/api/v1/auth/2fa/enable", json={"code": pyotp.TOTP(secret).now()})

    client.post("/api/v1/auth/email/backup/code", json={"email": "spare@example.com"})
    res = client.post("/api/v1/auth/email/backup", json={
        "current_password": "demo123456",
        "backup_email": "spare@example.com",
        "backup_email_code": last_code_for("spare@example.com"),
        "totp_code": pyotp.TOTP(secret).now(),
    })
    assert res.status_code == 200


# --------------------------------------------------------------------------
# Signing in with it — the point of the feature
# --------------------------------------------------------------------------

def test_signing_in_with_the_backup_address(client):
    register(client, "euan")
    login(client, "euan")
    bind_backup(client, "spare@example.com")
    client.post("/api/v1/auth/logout")

    res = client.post("/api/v1/auth/login", json={
        "credential": "spare@example.com", "password": "demo123456", "remember": True})
    assert res.status_code == 200
    assert client.get("/api/v1/auth/me").json()["username"] == "euan"


def test_an_unverified_backup_does_not_sign_in(client):
    """Set directly in the database, bypassing the code — it must not work."""
    register(client, "euan")

    with current_session() as db:
        from app.models import User
        user = db.query(User).filter(User.username == "euan").one()
        user.backup_email = "spare@example.com"
        user.backup_email_verified = False
        db.commit()

    res = client.post("/api/v1/auth/login", json={
        "credential": "spare@example.com", "password": "demo123456", "remember": True})
    assert res.status_code == 401


def test_the_backup_address_is_case_insensitive_at_sign_in(client):
    register(client, "euan")
    login(client, "euan")
    bind_backup(client, "spare@example.com")
    client.post("/api/v1/auth/logout")

    res = client.post("/api/v1/auth/login", json={
        "credential": "SPARE@Example.COM", "password": "demo123456", "remember": True})
    assert res.status_code == 200


# --------------------------------------------------------------------------
# Recovering through it
# --------------------------------------------------------------------------

def test_recovering_a_password_through_the_backup(client):
    register(client, "euan")
    login(client, "euan")
    bind_backup(client, "spare@example.com")
    client.post("/api/v1/auth/logout")

    client.post("/api/v1/auth/password/forgot", json={"email": "spare@example.com"})
    res = client.post("/api/v1/auth/password/reset", json={
        "email": "spare@example.com",
        "code": last_code_for("spare@example.com"),
        "new_password": "brandnew12345"})
    assert res.status_code == 200

    login(client, "euan", "brandnew12345")


def test_recovery_still_says_nothing_about_an_unknown_backup(client):
    register(client, "euan")

    known = client.post("/api/v1/auth/password/forgot", json={"email": "euan@example.com"})
    unknown = client.post("/api/v1/auth/password/forgot", json={"email": "spare@example.com"})
    assert known.json() == unknown.json()


# --------------------------------------------------------------------------
# Removing, and interaction with the primary
# --------------------------------------------------------------------------

def test_removing_the_backup(client):
    register(client, "euan")
    login(client, "euan")
    bind_backup(client, "spare@example.com")

    client.post("/api/v1/auth/step-up/code", params={"purpose": "change_email"})
    res = client.request("DELETE", "/api/v1/auth/email/backup", json={
        "current_password": "demo123456",
        "email_code": last_code_for("euan@example.com"),
    })
    assert res.status_code == 200
    assert client.get("/api/v1/auth/me").json()["backup_email"] is None


def test_a_removed_backup_no_longer_signs_in(client):
    register(client, "euan")
    login(client, "euan")
    bind_backup(client, "spare@example.com")
    client.post("/api/v1/auth/step-up/code", params={"purpose": "change_email"})
    client.request("DELETE", "/api/v1/auth/email/backup", json={
        "current_password": "demo123456",
        "email_code": last_code_for("euan@example.com"),
    })
    client.post("/api/v1/auth/logout")

    res = client.post("/api/v1/auth/login", json={
        "credential": "spare@example.com", "password": "demo123456", "remember": True})
    assert res.status_code == 401


def test_the_primary_cannot_be_moved_onto_the_backup(client):
    """Otherwise the account would end up with one address in both slots."""
    register(client, "euan")
    login(client, "euan")
    bind_backup(client, "spare@example.com")

    client.post("/api/v1/auth/step-up/code", params={"purpose": "change_email"})
    owner_code = last_code_for("euan@example.com")
    client.post("/api/v1/auth/email/change/code", json={"email": "spare@example.com"})

    res = client.post("/api/v1/auth/email/change", json={
        "current_password": "demo123456",
        "new_email": "spare@example.com",
        "new_email_code": "000000",
        "email_code": owner_code,
    })
    assert res.status_code == 400
