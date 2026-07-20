"""The username is the address and never changes; the display name does."""

from tests.conftest import current_session, login, register


def set_profile(client, display_name: str, bio: str = ""):
    return client.patch(
        "/api/v1/auth/profile", json={"display_name": display_name, "bio": bio}
    )


def test_the_display_name_can_be_changed(client):
    register(client, "euan")
    login(client, "euan")

    assert set_profile(client, "Euan Zhang", "写点东西").status_code == 200
    me = client.get("/api/v1/auth/me").json()
    assert me["display_name"] == "Euan Zhang"
    assert me["bio"] == "写点东西"


def test_the_username_is_untouched_by_a_profile_update(client):
    """`/{username}` is the address of everything this person published.
    Changing it would break every link anyone saved."""
    register(client, "euan")
    login(client, "euan")
    set_profile(client, "New Name")

    assert client.get("/api/v1/auth/me").json()["username"] == "euan"


def test_there_is_no_way_to_change_a_username(client):
    register(client, "euan")
    login(client, "euan")

    # Sending one is simply ignored — the schema has no such field.
    client.patch("/api/v1/auth/profile", json={
        "display_name": "Euan", "username": "someoneelse"})
    assert client.get("/api/v1/auth/me").json()["username"] == "euan"


def test_two_users_cannot_share_a_display_name(client):
    register(client, "alice")
    login(client, "alice")
    set_profile(client, "共同昵称")
    client.post("/api/v1/auth/logout")

    register(client, "euan")
    login(client, "euan")
    res = set_profile(client, "共同昵称")
    assert res.status_code == 409
    assert "昵称" in res.json()["detail"]


def test_display_name_uniqueness_ignores_case(client):
    """"Euan" and "euan" reading as different people would defeat the rule."""
    register(client, "alice")
    login(client, "alice")
    set_profile(client, "Euan")
    client.post("/api/v1/auth/logout")

    register(client, "bob")
    login(client, "bob")
    assert set_profile(client, "euan").status_code == 409
    assert set_profile(client, "EUAN").status_code == 409


def test_a_display_name_cannot_impersonate_another_username(client):
    """In a comment both appear as plain text, so this would read as them.

    alice's display name is moved aside first: otherwise "alice" would trip
    the case-insensitive uniqueness check and this would never exercise the
    impersonation rule at all.
    """
    register(client, "alice")
    login(client, "alice")
    set_profile(client, "Alice Wang")
    client.post("/api/v1/auth/logout")

    register(client, "euan")
    login(client, "euan")

    res = set_profile(client, "alice")
    assert res.status_code == 409
    assert "用户名" in res.json()["detail"]


def test_keeping_your_own_display_name_is_not_a_clash(client):
    register(client, "euan")
    login(client, "euan")
    set_profile(client, "Euan")

    assert set_profile(client, "Euan", "换了简介").status_code == 200


def test_an_empty_display_name_is_refused(client):
    register(client, "euan")
    login(client, "euan")

    assert set_profile(client, "   ").status_code in (400, 422)


def test_a_guest_cannot_change_a_profile(client):
    assert set_profile(client, "谁").status_code == 401


def test_the_change_is_audited(client):
    from app.models import AuditLog

    register(client, "euan")
    login(client, "euan")
    set_profile(client, "Euan Z")

    with current_session() as db:
        events = [a.event for a in db.query(AuditLog).all()]
    assert "profile_updated" in events
