"""The rules that actually protect the data, enforced server side."""
from tests.conftest import login, logout, make_content, register


def test_guest_cannot_see_private_content(client):
    register(client, "euan")
    login(client, "euan")
    make_content(client, visibility="private", title="私密笔记")
    logout(client)

    res = client.get("/api/v1/content", params={"author": "euan"})
    assert res.status_code == 200
    assert all(i["title"] != "私密笔记" for i in res.json())


def test_author_sees_own_private_content(client):
    register(client, "euan")
    login(client, "euan")
    make_content(client, visibility="private", title="私密笔记")

    titles = [i["title"] for i in client.get("/api/v1/content", params={"author": "euan"}).json()]
    assert "私密笔记" in titles


def test_another_user_cannot_see_your_private_content(client):
    register(client, "euan")
    register(client, "alice")
    login(client, "euan")
    make_content(client, visibility="private", title="只有我能看")
    logout(client)
    login(client, "alice")

    titles = [i["title"] for i in client.get("/api/v1/content", params={"author": "euan"}).json()]
    assert "只有我能看" not in titles


def test_private_content_404s_by_direct_url(client):
    register(client, "euan")
    login(client, "euan")
    item = make_content(client, visibility="draft")
    logout(client)

    res = client.get(f"/api/v1/content/euan/pkm/{item['slug']}")
    assert res.status_code == 404


# Missing and hidden must be indistinguishable.
def test_hidden_and_missing_give_the_same_answer(client):
    register(client, "euan")
    login(client, "euan")
    hidden = make_content(client, visibility="private")
    logout(client)

    a = client.get(f"/api/v1/content/euan/pkm/{hidden['slug']}")
    b = client.get("/api/v1/content/euan/pkm/no-such-slug")
    assert a.status_code == b.status_code == 404
    assert a.json()["detail"] == b.json()["detail"]


def test_slug_is_scoped_to_its_author(client):
    register(client, "euan")
    register(client, "alice")
    login(client, "euan")
    item = make_content(client, visibility="public")
    logout(client)

    # alice does not own this slug, so it must not resolve under her name.
    assert client.get(f"/api/v1/content/alice/pkm/{item['slug']}").status_code == 404


def test_slug_is_scoped_to_its_type(client):
    register(client, "euan")
    login(client, "euan")
    diary = make_content(client, type="diary", content_kind=None, visibility="public")

    # A diary entry must not open through the notes route.
    assert client.get(f"/api/v1/content/euan/pkm/{diary['slug']}").status_code == 404
    assert client.get(f"/api/v1/content/euan/diary/{diary['slug']}").status_code == 200


def test_another_user_cannot_edit_your_content(client):
    register(client, "euan")
    register(client, "alice")
    login(client, "euan")
    item = make_content(client, title="我的标题")
    logout(client)
    login(client, "alice")

    res = client.patch(f"/api/v1/content/{item['id']}", json={"title": "被改了"})
    assert res.status_code == 404
    logout(client)
    login(client, "euan")
    assert client.get(f"/api/v1/content/euan/pkm/{item['slug']}").json()["title"] == "我的标题"


def test_another_user_cannot_delete_your_content(client):
    register(client, "euan")
    register(client, "alice")
    login(client, "euan")
    item = make_content(client)
    logout(client)
    login(client, "alice")

    assert client.delete(f"/api/v1/content/{item['id']}").status_code == 404


def test_writing_requires_a_session(client):
    register(client, "euan")
    res = client.post("/api/v1/content", json={
        "type": "pkm", "title": "x", "body": "y", "visibility": "public"})
    assert res.status_code == 401


def test_guest_cannot_see_a_folder_holding_only_private_content(client):
    register(client, "euan")
    login(client, "euan")
    folder = client.post("/api/v1/library/folders", json={"name": "私密文件夹"}).json()
    make_content(client, visibility="private", folder_ids=[folder["id"]])
    logout(client)

    names = [f["name"] for f in client.get("/api/v1/library/folders", params={"author": "euan"}).json()]
    assert "私密文件夹" not in names


def test_guest_sees_a_folder_holding_public_content(client):
    register(client, "euan")
    login(client, "euan")
    folder = client.post("/api/v1/library/folders", json={"name": "公开文件夹"}).json()
    make_content(client, visibility="public", folder_ids=[folder["id"]])
    logout(client)

    names = [f["name"] for f in client.get("/api/v1/library/folders", params={"author": "euan"}).json()]
    assert "公开文件夹" in names
