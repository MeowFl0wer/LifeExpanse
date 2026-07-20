"""Stored URLs are refused at the door, not filtered on the way out.

The frontend refuses a `javascript:` link at render time, but relying on every
future consumer to remember is the wrong shape: an export, a feed, or a
template that forgets would hand it straight to a reader.
"""

from tests.conftest import login, make_content, register


def create(client, **overrides):
    payload = {
        "type": "thought", "thought_type": "excerpt", "title": "摘录",
        "body": "正文", "visibility": "public", "tags": [],
        "folder_ids": [], "series_ids": [],
    }
    payload.update(overrides)
    return client.post("/api/v1/content", json=payload)


def test_an_https_source_link_is_accepted(client):
    register(client, "euan")
    login(client, "euan")
    res = create(client, source_url="https://example.com/book")
    assert res.status_code == 201
    assert res.json()["source_url"] == "https://example.com/book"


def test_a_mailto_source_link_is_accepted(client):
    register(client, "euan")
    login(client, "euan")
    assert create(client, source_url="mailto:someone@example.com").status_code == 201


def test_a_javascript_source_link_is_refused(client):
    register(client, "euan")
    login(client, "euan")
    assert create(client, source_url="javascript:alert(1)").status_code == 422


def test_a_source_link_hiding_its_scheme_is_refused(client):
    """Browsers ignore whitespace and control characters when parsing a scheme."""
    register(client, "euan")
    login(client, "euan")
    for hostile in (
        "  javascript:alert(1)",
        "java\tscript:alert(1)",
        "java\nscript:alert(1)",
        "JAVASCRIPT:alert(1)",
    ):
        assert create(client, source_url=hostile).status_code == 422, hostile


def test_data_and_file_source_links_are_refused(client):
    register(client, "euan")
    login(client, "euan")
    assert create(client, source_url="data:text/html,<script>x</script>").status_code == 422
    assert create(client, source_url="file:///etc/passwd").status_code == 422


def test_plain_http_is_refused(client):
    register(client, "euan")
    login(client, "euan")
    assert create(client, source_url="http://example.com").status_code == 422


def test_a_hostile_source_link_cannot_be_patched_in_later(client):
    """The create path is not the only way in."""
    register(client, "euan")
    login(client, "euan")
    item = create(client, source_url="https://example.com").json()

    res = client.patch(f"/api/v1/content/{item['id']}", json={
        "source_url": "javascript:alert(1)"})
    assert res.status_code == 422
    assert client.get(f"/api/v1/content/euan/thought/{item['slug']}").json()["source_url"] \
        == "https://example.com"


def test_excerpt_provenance_can_be_corrected(client):
    """An excerpt saved with the wrong source used to be stuck with it: the
    fields had nowhere to go on the update path."""
    register(client, "euan")
    login(client, "euan")
    item = create(client, source_author="旧作者", source_title="旧书名").json()

    res = client.patch(f"/api/v1/content/{item['id']}", json={
        "source_author": "新作者",
        "source_title": "新书名",
        "source_type": "book",
        "source_locator": "第 42 页",
        "source_url": "https://example.com/new",
    })
    assert res.status_code == 200
    body = res.json()
    assert body["source_author"] == "新作者"
    assert body["source_title"] == "新书名"
    assert body["source_locator"] == "第 42 页"
    assert body["source_url"] == "https://example.com/new"


def test_a_javascript_cover_is_refused(client):
    """A cover ends up in an <img src>."""
    register(client, "euan")
    login(client, "euan")
    assert make_content_raw(client, cover="javascript:alert(1)").status_code == 422


def test_a_data_cover_is_refused(client):
    register(client, "euan")
    login(client, "euan")
    assert make_content_raw(client, cover="data:text/html,<script>x</script>").status_code == 422


def test_a_protocol_relative_cover_is_refused(client):
    """A leading slash is not enough — this leaves the site."""
    register(client, "euan")
    login(client, "euan")
    assert make_content_raw(client, cover="//evil.example/a.png").status_code == 422


def test_a_managed_media_cover_is_accepted(client):
    register(client, "euan")
    login(client, "euan")
    assert make_content_raw(client, cover="/api/v1/media/abc123").status_code == 201


def make_content_raw(client, **overrides):
    payload = {
        "type": "pkm", "content_kind": "note", "title": "笔记",
        "body": "正文", "visibility": "public", "tags": [],
        "folder_ids": [], "series_ids": [],
    }
    payload.update(overrides)
    return client.post("/api/v1/content", json=payload)


def test_a_hostile_folder_cover_is_refused(client):
    register(client, "euan")
    login(client, "euan")
    res = client.post("/api/v1/library/folders", json={
        "name": "文件夹", "description": "", "cover": "javascript:alert(1)", "series_ids": []})
    assert res.status_code == 422
