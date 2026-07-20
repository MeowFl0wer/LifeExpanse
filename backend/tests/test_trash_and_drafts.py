from tests.conftest import login, logout, make_content, register


def test_delete_moves_to_the_bin_not_oblivion(client):
    register(client, "euan")
    login(client, "euan")
    item = make_content(client, title="要删掉的")

    client.delete(f"/api/v1/content/{item['id']}")

    listed = client.get("/api/v1/content", params={"author": "euan"}).json()
    assert all(i["title"] != "要删掉的" for i in listed)

    binned = client.get("/api/v1/trash").json()
    assert [t["item"]["title"] for t in binned] == ["要删掉的"]
    assert binned[0]["days_remaining"] > 0


def test_deleted_content_404s_by_url(client):
    register(client, "euan")
    login(client, "euan")
    item = make_content(client)
    client.delete(f"/api/v1/content/{item['id']}")

    assert client.get(f"/api/v1/content/euan/pkm/{item['slug']}").status_code == 404


def test_restore_brings_it_back(client):
    register(client, "euan")
    login(client, "euan")
    item = make_content(client, title="会恢复的")
    client.delete(f"/api/v1/content/{item['id']}")

    client.post(f"/api/v1/trash/{item['id']}/restore")

    listed = client.get("/api/v1/content", params={"author": "euan"}).json()
    assert any(i["title"] == "会恢复的" for i in listed)
    assert client.get("/api/v1/trash").json() == []


def test_restore_resolves_a_slug_taken_meanwhile(client):
    register(client, "euan")
    login(client, "euan")
    first = make_content(client, title="Same Name")
    client.delete(f"/api/v1/content/{first['id']}")
    second = make_content(client, title="Same Name")

    restored = client.post(f"/api/v1/trash/{first['id']}/restore").json()
    assert restored["slug"] != second["slug"]


def test_purge_is_permanent(client):
    register(client, "euan")
    login(client, "euan")
    item = make_content(client)
    client.delete(f"/api/v1/content/{item['id']}")

    client.delete(f"/api/v1/trash/{item['id']}")
    assert client.get("/api/v1/trash").json() == []
    assert client.post(f"/api/v1/trash/{item['id']}/restore").status_code == 404


def test_trash_is_per_user(client):
    register(client, "euan")
    register(client, "alice")
    login(client, "euan")
    item = make_content(client)
    client.delete(f"/api/v1/content/{item['id']}")
    logout(client)
    login(client, "alice")

    assert client.get("/api/v1/trash").json() == []
    assert client.post(f"/api/v1/trash/{item['id']}/restore").status_code == 404


# The point of server-side drafts: an unfinished edit follows you to another
# device, which a browser-local copy cannot do.
def test_draft_round_trips_across_sessions(client):
    register(client, "euan")
    login(client, "euan")
    client.put("/api/v1/drafts/euan:new:note", json={"payload": {"title": "写了一半"}})
    logout(client)

    # A different device is simply a different session.
    login(client, "euan")
    got = client.get("/api/v1/drafts/euan:new:note").json()
    assert got["payload"]["title"] == "写了一半"


def test_draft_upsert_overwrites(client):
    register(client, "euan")
    login(client, "euan")
    client.put("/api/v1/drafts/k", json={"payload": {"title": "第一版"}})
    client.put("/api/v1/drafts/k", json={"payload": {"title": "第二版"}})
    assert client.get("/api/v1/drafts/k").json()["payload"]["title"] == "第二版"


def test_drafts_are_private_to_their_owner(client):
    register(client, "euan")
    register(client, "alice")
    login(client, "euan")
    client.put("/api/v1/drafts/shared-key", json={"payload": {"title": "euan 的草稿"}})
    logout(client)
    login(client, "alice")

    assert client.get("/api/v1/drafts/shared-key").json() is None
    assert client.get("/api/v1/drafts").json() == []


def test_draft_delete(client):
    register(client, "euan")
    login(client, "euan")
    client.put("/api/v1/drafts/k", json={"payload": {"title": "x"}})
    client.delete("/api/v1/drafts/k")
    assert client.get("/api/v1/drafts/k").json() is None


def test_drafts_require_a_session(client):
    assert client.get("/api/v1/drafts").status_code == 401
    assert client.put("/api/v1/drafts/k", json={"payload": {}}).status_code == 401
