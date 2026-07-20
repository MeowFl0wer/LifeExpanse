from tests.conftest import login, logout, make_content, register


def _article(client):
    item = make_content(client, visibility="public")
    return client.post(f"/api/v1/content/{item['id']}/publish").json()


def test_signed_in_user_can_comment(client):
    register(client, "euan")
    register(client, "alice")
    login(client, "euan")
    article = _article(client)
    logout(client)

    login(client, "alice")
    res = client.post(f"/api/v1/content/{article['id']}/comments", json={"body": "写得好"})
    assert res.status_code == 201
    assert res.json()["author"] == "alice"


def test_guest_cannot_comment(client):
    register(client, "euan")
    login(client, "euan")
    article = _article(client)
    logout(client)

    res = client.post(f"/api/v1/content/{article['id']}/comments", json={"body": "路过"})
    assert res.status_code == 401


def test_cannot_comment_where_comments_are_off(client):
    register(client, "euan")
    login(client, "euan")
    note = make_content(client, visibility="public")  # a note: comments off

    res = client.post(f"/api/v1/content/{note['id']}/comments", json={"body": "试试"})
    assert res.status_code == 403


def test_commenter_can_delete_their_own(client):
    register(client, "euan")
    register(client, "alice")
    login(client, "euan")
    article = _article(client)
    logout(client)
    login(client, "alice")
    comment = client.post(f"/api/v1/content/{article['id']}/comments", json={"body": "x"}).json()

    assert client.delete(
        f"/api/v1/content/{article['id']}/comments/{comment['id']}").status_code == 204


def test_author_can_remove_comments_on_their_content(client):
    register(client, "euan")
    register(client, "alice")
    login(client, "euan")
    article = _article(client)
    logout(client)
    login(client, "alice")
    comment = client.post(f"/api/v1/content/{article['id']}/comments", json={"body": "x"}).json()
    logout(client)

    login(client, "euan")
    assert client.delete(
        f"/api/v1/content/{article['id']}/comments/{comment['id']}").status_code == 204


def test_third_party_cannot_remove_someone_elses_comment(client):
    register(client, "euan")
    register(client, "alice")
    register(client, "bob")
    login(client, "euan")
    article = _article(client)
    logout(client)
    login(client, "alice")
    comment = client.post(f"/api/v1/content/{article['id']}/comments", json={"body": "x"}).json()
    logout(client)

    login(client, "bob")
    assert client.delete(
        f"/api/v1/content/{article['id']}/comments/{comment['id']}").status_code == 404
