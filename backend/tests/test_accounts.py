"""Registration, email verification and step-up checks.

The recurring theme: a stranger must never be able to tell from a response
whether an address or account exists.
"""

from app import email as mailer
from tests.conftest import last_code_for, login, register


def request_register_code(client, address: str):
    return client.post("/api/v1/auth/register/code", json={"email": address})


# --------------------------------------------------------------------------
# Registration
# --------------------------------------------------------------------------

def test_registration_requires_a_code_from_the_inbox(client):
    request_register_code(client, "new@example.com")
    res = client.post("/api/v1/auth/register", json={
        "username": "newbie", "email": "new@example.com",
        "password": "demo123456", "code": "000000"})
    assert res.status_code == 400
    assert "验证码" in res.json()["detail"]


def test_registration_succeeds_with_the_right_code(client):
    request_register_code(client, "new@example.com")
    res = client.post("/api/v1/auth/register", json={
        "username": "newbie", "email": "new@example.com",
        "password": "demo123456", "code": last_code_for("new@example.com")})
    assert res.status_code == 201
    assert res.json()["role"] == "user"


def test_a_code_works_only_once(client):
    request_register_code(client, "new@example.com")
    code = last_code_for("new@example.com")
    client.post("/api/v1/auth/register", json={
        "username": "newbie", "email": "new@example.com",
        "password": "demo123456", "code": code})

    request_register_code(client, "second@example.com")
    res = client.post("/api/v1/auth/register", json={
        "username": "another", "email": "second@example.com",
        "password": "demo123456", "code": code})
    assert res.status_code == 400


def test_guessing_a_code_runs_out_of_attempts(client):
    request_register_code(client, "new@example.com")
    real = last_code_for("new@example.com")

    for _ in range(5):
        client.post("/api/v1/auth/register", json={
            "username": "newbie", "email": "new@example.com",
            "password": "demo123456", "code": "999999"})

    # Even the correct code is refused once the attempts are spent.
    res = client.post("/api/v1/auth/register", json={
        "username": "newbie", "email": "new@example.com",
        "password": "demo123456", "code": real})
    assert res.status_code == 400


def test_requesting_codes_is_rate_limited(client):
    for _ in range(10):
        assert request_register_code(client, "flood@example.com").status_code == 200

    sent = [m for m in mailer.outbox if m.to == "flood@example.com" and "验证码" in m.subject]
    assert len(sent) <= 5


# --------------------------------------------------------------------------
# Enumeration resistance
# --------------------------------------------------------------------------

def test_registering_a_taken_address_looks_identical(client):
    register(client, "euan")

    free = request_register_code(client, "free@example.com")
    taken = request_register_code(client, "euan@example.com")

    assert free.status_code == taken.status_code
    assert free.json() == taken.json()


def test_a_taken_address_gets_a_warning_instead_of_a_code(client):
    register(client, "euan")
    mailer.outbox.clear()
    request_register_code(client, "euan@example.com")

    body = mailer.outbox[-1].body
    assert "已经绑定了一个账号" in body
    assert "验证码" not in mailer.outbox[-1].subject


def test_forgot_password_says_the_same_for_unknown_addresses(client):
    register(client, "euan")

    known = client.post("/api/v1/auth/password/forgot", json={"email": "euan@example.com"})
    unknown = client.post("/api/v1/auth/password/forgot", json={"email": "nobody@example.com"})

    assert known.status_code == unknown.status_code
    assert known.json() == unknown.json()


def test_an_address_can_only_belong_to_one_account(client):
    register(client, "euan")
    request_register_code(client, "euan@example.com")
    res = client.post("/api/v1/auth/register", json={
        "username": "someoneelse", "email": "euan@example.com",
        "password": "demo123456", "code": "000000"})
    assert res.status_code == 400


# --------------------------------------------------------------------------
# Reserved usernames
# --------------------------------------------------------------------------

def test_platform_routes_cannot_be_claimed_as_usernames(client):
    # Two refusals are in play: the length/shape rule (422, e.g. "me" is only
    # two characters) and the reserved list (400). Either is fine — what
    # matters is that none of these names ends up shadowing a real route.
    for reserved in ("me", "admin", "settings", "trash", "pkm"):
        request_register_code(client, f"{reserved}@example.com")
        res = client.post("/api/v1/auth/register", json={
            "username": reserved, "email": f"{reserved}@example.com",
            "password": "demo123456", "code": "000000"})
        assert res.status_code in (400, 422), reserved


# --------------------------------------------------------------------------
# Password reset
# --------------------------------------------------------------------------

def test_reset_password_with_an_emailed_code(client):
    register(client, "euan")
    client.post("/api/v1/auth/password/forgot", json={"email": "euan@example.com"})

    res = client.post("/api/v1/auth/password/reset", json={
        "email": "euan@example.com",
        "code": last_code_for("euan@example.com"),
        "new_password": "brandnew12345"})
    assert res.status_code == 200

    login(client, "euan", "brandnew12345")


def test_reset_revokes_existing_sessions(client):
    register(client, "euan")
    login(client, "euan")
    assert client.get("/api/v1/auth/me").status_code == 200

    client.post("/api/v1/auth/password/forgot", json={"email": "euan@example.com"})
    client.post("/api/v1/auth/password/reset", json={
        "email": "euan@example.com",
        "code": last_code_for("euan@example.com"),
        "new_password": "brandnew12345"})

    # An attacker who already had a session must not keep it.
    assert client.get("/api/v1/auth/me").status_code == 401


# --------------------------------------------------------------------------
# Changing a password — needs the current password *and* a second proof
# --------------------------------------------------------------------------

def test_changing_a_password_needs_more_than_the_current_one(client):
    register(client, "euan")
    login(client, "euan")

    res = client.post("/api/v1/auth/password/change", json={
        "current_password": "demo123456", "new_password": "brandnew12345"})
    assert res.status_code == 400
    assert "验证码" in res.json()["detail"]


def test_changing_a_password_needs_the_current_one(client):
    register(client, "euan")
    login(client, "euan")
    client.post("/api/v1/auth/step-up/code", params={"purpose": "change_password"})

    res = client.post("/api/v1/auth/password/change", json={
        "current_password": "wrongwrong", "new_password": "brandnew12345",
        "email_code": last_code_for("euan@example.com")})
    assert res.status_code == 400
    assert "当前密码" in res.json()["detail"]


def test_changing_a_password_with_both_proofs(client):
    register(client, "euan")
    login(client, "euan")
    client.post("/api/v1/auth/step-up/code", params={"purpose": "change_password"})

    res = client.post("/api/v1/auth/password/change", json={
        "current_password": "demo123456", "new_password": "brandnew12345",
        "email_code": last_code_for("euan@example.com")})
    assert res.status_code == 200

    client.post("/api/v1/auth/logout")
    login(client, "euan", "brandnew12345")


def test_password_change_notifies_the_owner(client):
    register(client, "euan")
    login(client, "euan")
    client.post("/api/v1/auth/step-up/code", params={"purpose": "change_password"})
    client.post("/api/v1/auth/password/change", json={
        "current_password": "demo123456", "new_password": "brandnew12345",
        "email_code": last_code_for("euan@example.com")})

    assert any("密码已修改" in m.subject for m in mailer.outbox)


# --------------------------------------------------------------------------
# Changing an email
# --------------------------------------------------------------------------

def change_email(client, new_address: str):
    client.post("/api/v1/auth/step-up/code", params={"purpose": "change_email"})
    owner_code = last_code_for("euan@example.com")
    client.post("/api/v1/auth/email/change/code", json={"email": new_address})
    return client.post("/api/v1/auth/email/change", json={
        "current_password": "demo123456",
        "new_email": new_address,
        "new_email_code": last_code_for(new_address),
        "email_code": owner_code,
    })


def test_changing_an_email_needs_both_addresses_to_prove_themselves(client):
    register(client, "euan")
    login(client, "euan")

    assert change_email(client, "moved@example.com").status_code == 200
    assert client.get("/api/v1/auth/me").json()["email"] == "moved@example.com"


def test_the_old_address_is_told_about_the_change(client):
    register(client, "euan")
    login(client, "euan")
    change_email(client, "moved@example.com")

    notices = [m for m in mailer.outbox if "邮箱已变更" in m.subject]
    assert notices, "the replaced address was never warned"
    # It goes to the address being replaced — that is the victim's one chance
    # to notice a takeover.
    assert notices[-1].to == "euan@example.com"
    # And it must not hand the new address to whoever reads the old inbox.
    assert "moved@example.com" not in notices[-1].body
    assert "m***d@example.com" in notices[-1].body


def test_cannot_move_to_an_address_that_is_taken(client):
    register(client, "alice")
    register(client, "euan")
    login(client, "euan")

    assert change_email(client, "alice@example.com").status_code == 400
    assert client.get("/api/v1/auth/me").json()["email"] == "euan@example.com"


# --------------------------------------------------------------------------
# Login statistics (the admin console sorts on these)
# --------------------------------------------------------------------------

def test_login_count_and_last_login_are_recorded(client):
    from app.models import User
    from tests.conftest import current_session

    register(client, "euan")
    login(client, "euan")
    client.post("/api/v1/auth/logout")
    login(client, "euan")

    with current_session() as db:
        user = db.query(User).filter(User.username == "euan").one()
        assert user.login_count == 2
        assert user.last_login_at is not None


# --------------------------------------------------------------------------
# The administrative account
# --------------------------------------------------------------------------

def test_the_admin_account_is_created_on_first_start(client):
    from app.bootstrap import ensure_admin
    from app.models import User
    from tests.conftest import current_session

    with current_session() as db:
        ensure_admin(db)
        admin = db.query(User).filter(User.username == "AdminEuan").one()
        assert admin.role == "admin"
        # 需求 3.1: the admin has no content space, so upload permissions on it
        # would be meaningless.
        assert admin.can_upload_image is False
        assert admin.can_upload_video is False


def test_admin_bootstrap_is_idempotent(client):
    from app.bootstrap import ensure_admin
    from app.models import User
    from tests.conftest import current_session

    with current_session() as db:
        first = ensure_admin(db)
        second = ensure_admin(db)
        assert first.id == second.id
        assert db.query(User).filter(User.username == "AdminEuan").count() == 1


def test_admin_bootstrap_never_leaves_a_blank_password(client):
    """An unconfigured deployment must not end up with a guessable admin."""
    from app.bootstrap import ensure_admin
    from app.security import verify_password
    from tests.conftest import current_session

    with current_session() as db:
        admin = ensure_admin(db)
        assert admin.password_hash
        for guess in ("", "admin", "password", "AdminEuan", "123456"):
            assert not verify_password(guess, admin.password_hash)


def test_new_users_get_images_but_not_video(client):
    body = register(client, "euan")
    assert body["can_upload_image"] is True
    assert body["can_upload_video"] is False
    assert body["role"] == "user"
