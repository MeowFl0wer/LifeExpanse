from tests.conftest import login, logout, make_content, register


def test_folder_and_series_round_trip(client):
    register(client, "euan")
    login(client, "euan")
    series = client.post("/api/v1/library/series", json={"name": "工程笔记"}).json()
    folder = client.post("/api/v1/library/folders", json={
        "name": "前端", "series_ids": [series["id"]]}).json()

    assert folder["series_ids"] == [series["id"]]


# Rule: a note inside a folder that belongs to series S must not also be filed
# directly into S, or it would appear loose beside its own folder.
def test_series_inherited_from_folder_is_not_duplicated(client):
    register(client, "euan")
    login(client, "euan")
    series = client.post("/api/v1/library/series", json={"name": "工程笔记"}).json()
    folder = client.post("/api/v1/library/folders", json={
        "name": "前端", "series_ids": [series["id"]]}).json()

    item = make_content(client, folder_ids=[folder["id"]], series_ids=[series["id"]])
    assert item["folder_ids"] == [folder["id"]]
    assert item["series_ids"] == []


def test_direct_series_is_kept_when_no_folder_covers_it(client):
    register(client, "euan")
    login(client, "euan")
    series = client.post("/api/v1/library/series", json={"name": "独立系列"}).json()
    item = make_content(client, series_ids=[series["id"]])
    assert item["series_ids"] == [series["id"]]


def test_content_may_sit_in_several_folders(client):
    register(client, "euan")
    login(client, "euan")
    a = client.post("/api/v1/library/folders", json={"name": "A"}).json()
    b = client.post("/api/v1/library/folders", json={"name": "B"}).json()
    item = make_content(client, folder_ids=[a["id"], b["id"]])
    assert sorted(item["folder_ids"]) == sorted([a["id"], b["id"]])


# Deleting a container must never destroy what it held.
def test_deleting_a_folder_detaches_rather_than_deletes(client):
    register(client, "euan")
    login(client, "euan")
    folder = client.post("/api/v1/library/folders", json={"name": "待删"}).json()
    item = make_content(client, folder_ids=[folder["id"]])

    res = client.delete(f"/api/v1/library/folders/{folder['id']}")
    assert res.json()["detached"] == 1

    still_there = client.get(f"/api/v1/content/euan/pkm/{item['slug']}")
    assert still_there.status_code == 200
    assert still_there.json()["folder_ids"] == []


def test_deleting_a_series_detaches_folders_and_content(client):
    register(client, "euan")
    login(client, "euan")
    series = client.post("/api/v1/library/series", json={"name": "待删系列"}).json()
    client.post("/api/v1/library/folders", json={"name": "子", "series_ids": [series["id"]]})
    item = make_content(client, series_ids=[series["id"]])

    res = client.delete(f"/api/v1/library/series/{series['id']}")
    assert res.json() == {"detached_folders": 1, "detached_items": 1}
    assert client.get(f"/api/v1/content/euan/pkm/{item['slug']}").status_code == 200


def test_another_user_cannot_touch_your_library(client):
    register(client, "euan")
    register(client, "alice")
    login(client, "euan")
    folder = client.post("/api/v1/library/folders", json={"name": "我的"}).json()
    logout(client)
    login(client, "alice")

    assert client.patch(
        f"/api/v1/library/folders/{folder['id']}", json={"name": "改名"}).status_code == 404
    assert client.delete(f"/api/v1/library/folders/{folder['id']}").status_code == 404


def test_cannot_file_content_into_someone_elses_folder(client):
    register(client, "euan")
    register(client, "alice")
    login(client, "euan")
    folder = client.post("/api/v1/library/folders", json={"name": "euan 的"}).json()
    logout(client)
    login(client, "alice")

    res = client.post("/api/v1/content", json={
        "type": "pkm", "title": "试图归入别人的文件夹", "body": "x",
        "visibility": "public", "folder_ids": [folder["id"]]})
    assert res.status_code == 404
