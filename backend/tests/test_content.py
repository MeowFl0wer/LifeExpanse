from tests.conftest import login, make_content, register


def test_create_and_read_back(client):
    register(client, "euan")
    login(client, "euan")
    item = make_content(client, title="我的笔记", body="正文内容")

    res = client.get(f"/api/v1/content/euan/pkm/{item['slug']}")
    assert res.status_code == 200
    assert res.json()["title"] == "我的笔记"


def test_slug_collisions_are_resolved(client):
    register(client, "euan")
    login(client, "euan")
    a = make_content(client, title="Same Title")
    b = make_content(client, title="Same Title")
    assert a["slug"] != b["slug"]


def test_empty_body_is_rejected(client):
    register(client, "euan")
    login(client, "euan")
    res = client.post("/api/v1/content", json={
        "type": "pkm", "title": "x", "body": "   ", "visibility": "public"})
    assert res.status_code == 422


def test_draft_has_no_published_date(client):
    register(client, "euan")
    login(client, "euan")
    item = make_content(client, visibility="draft")
    assert item["published_at"] is None


def test_patch_only_touches_given_fields(client):
    register(client, "euan")
    login(client, "euan")
    item = make_content(client, title="原标题", summary="原摘要")

    res = client.patch(f"/api/v1/content/{item['id']}", json={"title": "新标题"})
    assert res.status_code == 200
    assert res.json()["title"] == "新标题"
    assert res.json()["summary"] == "原摘要"


def test_publish_keeps_id_and_body(client):
    register(client, "euan")
    login(client, "euan")
    note = make_content(client, body="原始正文")

    res = client.post(f"/api/v1/content/{note['id']}/publish")
    assert res.status_code == 200
    assert res.json()["id"] == note["id"]
    assert res.json()["body"] == "原始正文"
    assert res.json()["content_kind"] == "article"
    assert res.json()["allow_comments"] is True


def test_revert_turns_comments_off(client):
    register(client, "euan")
    login(client, "euan")
    note = make_content(client)
    client.post(f"/api/v1/content/{note['id']}/publish")

    res = client.post(f"/api/v1/content/{note['id']}/revert")
    assert res.json()["content_kind"] == "note"
    assert res.json()["allow_comments"] is False


def test_tags_round_trip_and_deduplicate(client):
    register(client, "euan")
    login(client, "euan")
    item = make_content(client, tags=["技术", "技术", "#前端"])
    assert sorted(item["tags"]) == sorted(["技术", "前端"])


def test_archived_content_is_out_of_the_default_list(client):
    register(client, "euan")
    login(client, "euan")
    item = make_content(client, title="归档的")
    client.patch(f"/api/v1/content/{item['id']}", json={"archived": True})

    default = client.get("/api/v1/content", params={"author": "euan"}).json()
    included = client.get(
        "/api/v1/content", params={"author": "euan", "include_archived": True}).json()

    assert all(i["title"] != "归档的" for i in default)
    assert any(i["title"] == "归档的" for i in included)


def test_keyword_and_tag_filters(client):
    register(client, "euan")
    login(client, "euan")
    make_content(client, title="React 并发", tags=["React"])
    make_content(client, title="SSH 配置", tags=["Linux"])

    by_tag = client.get("/api/v1/content", params={"author": "euan", "tag": ["React"]}).json()
    assert [i["title"] for i in by_tag] == ["React 并发"]

    by_kw = client.get("/api/v1/content", params={"author": "euan", "keyword": "ssh"}).json()
    assert [i["title"] for i in by_kw] == ["SSH 配置"]


def test_a_very_long_title_produces_a_slug_that_fits(client):
    """A title is user input; an uncapped slug would overflow the String(200)
    column on a real database."""
    from app.services import slugify, MAX_SLUG_LENGTH

    slug = slugify("word " * 200, "entry")
    assert len(slug) <= MAX_SLUG_LENGTH
    assert not slug.endswith("-")


def test_a_long_but_valid_title_produces_a_capped_slug(client):
    register(client, "euan")
    login(client, "euan")
    res = make_content(client, title="word " * 55)  # 275 chars, under the title cap
    assert res["slug"]
    assert len(res["slug"]) <= 200


def test_the_uniqueness_suffix_stays_within_the_column(client):
    """base + '-2' must still fit after capping."""
    register(client, "euan")
    login(client, "euan")
    long_title = "collision " * 25  # 250 chars, under the title cap
    first = make_content(client, title=long_title)
    second = make_content(client, title=long_title)
    assert first["slug"] != second["slug"]
    assert len(second["slug"]) <= 200


def test_an_over_long_title_is_refused(client):
    """The title column is String(300); the API used to accept any length and
    leave the database to silently store or reject it."""
    register(client, "euan")
    login(client, "euan")
    res = client.post("/api/v1/content", json={
        "type": "pkm", "content_kind": "note", "title": "a" * 400,
        "body": "正文", "visibility": "public", "tags": [],
        "folder_ids": [], "series_ids": [],
    })
    assert res.status_code == 422


def test_an_over_long_body_is_refused(client):
    register(client, "euan")
    login(client, "euan")
    res = client.post("/api/v1/content", json={
        "type": "pkm", "content_kind": "note", "title": "标题",
        "body": "x" * 200_000, "visibility": "public", "tags": [],
        "folder_ids": [], "series_ids": [],
    })
    assert res.status_code == 422


def test_an_over_long_tag_is_refused(client):
    register(client, "euan")
    login(client, "euan")
    res = client.post("/api/v1/content", json={
        "type": "pkm", "content_kind": "note", "title": "标题",
        "body": "正文", "visibility": "public", "tags": ["t" * 80],
        "folder_ids": [], "series_ids": [],
    })
    assert res.status_code == 422


def test_too_many_tags_are_refused(client):
    register(client, "euan")
    login(client, "euan")
    res = client.post("/api/v1/content", json={
        "type": "pkm", "content_kind": "note", "title": "标题",
        "body": "正文", "visibility": "public", "tags": [f"t{i}" for i in range(60)],
        "folder_ids": [], "series_ids": [],
    })
    assert res.status_code == 422


def test_an_over_long_title_cannot_be_patched_in(client):
    register(client, "euan")
    login(client, "euan")
    item = make_content(client)
    res = client.patch(f"/api/v1/content/{item['id']}", json={"title": "b" * 400})
    assert res.status_code == 422


def test_a_reasonable_title_and_body_still_work(client):
    register(client, "euan")
    login(client, "euan")
    res = make_content(client, title="正常标题", body="正常正文" * 100)
    assert res["title"] == "正常标题"
