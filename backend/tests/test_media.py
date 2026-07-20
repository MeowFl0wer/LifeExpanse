"""Uploads: permissions, type checking, quota, and who may read a file back."""

import io

from tests.conftest import current_session, login, register

# Minimal but genuine headers. The endpoint decides the type from these bytes,
# so a test that lied here would not be testing the real path.
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
GIF = b"GIF89a" + b"\x00" * 64
WEBP = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"\x00" * 64
MP4 = b"\x00\x00\x00\x18" + b"ftyp" + b"isom" + b"\x00" * 64
WEBM = b"\x1a\x45\xdf\xa3" + b"\x00" * 8 + b"webm" + b"\x00" * 48

HTML = b"<!DOCTYPE html><script>alert(1)</script>"
ELF = b"\x7fELF" + b"\x00" * 64


def upload(client, data: bytes, name="a.png", ctype="image/png", **params):
    return client.post(
        "/api/v1/media",
        files={"file": (name, io.BytesIO(data), ctype)},
        params=params,
    )


def grant(username: str, *, image=None, video=None) -> None:
    from app.models import User

    with current_session() as db:
        user = db.query(User).filter(User.username == username).one()
        if image is not None:
            user.can_upload_image = image
        if video is not None:
            user.can_upload_video = video
        db.commit()


# --------------------------------------------------------------------------
# Permissions
# --------------------------------------------------------------------------

def test_a_guest_cannot_upload(client):
    assert upload(client, PNG).status_code == 401


def test_images_work_by_default(client):
    register(client, "euan")
    login(client, "euan")
    res = upload(client, PNG)
    assert res.status_code == 201
    assert res.json()["kind"] == "image"


def test_video_is_refused_until_an_admin_grants_it(client):
    register(client, "euan")
    login(client, "euan")

    assert upload(client, MP4, name="a.mp4", ctype="video/mp4").status_code == 403

    grant("euan", video=True)
    assert upload(client, MP4, name="a.mp4", ctype="video/mp4").status_code == 201


def test_revoking_image_permission_stops_uploads(client):
    register(client, "euan")
    login(client, "euan")
    grant("euan", image=False)

    assert upload(client, PNG).status_code == 403


def test_an_avatar_is_allowed_even_without_the_image_permission(client):
    """A profile picture is part of having an account, not a content privilege."""
    register(client, "euan")
    login(client, "euan")
    grant("euan", image=False)

    res = upload(client, PNG, as_avatar=True)
    assert res.status_code == 201
    # An avatar has to be readable by visitors, so it is public.
    assert res.json()["visibility"] == "public"


def test_an_avatar_must_be_an_image(client):
    register(client, "euan")
    login(client, "euan")
    grant("euan", video=True)

    assert upload(client, MP4, name="a.mp4", as_avatar=True).status_code == 400


# --------------------------------------------------------------------------
# What the file actually is
# --------------------------------------------------------------------------

def test_every_allowed_type_is_recognised(client):
    register(client, "euan")
    login(client, "euan")
    grant("euan", video=True)

    for data, expected in [
        (PNG, "image/png"), (JPEG, "image/jpeg"), (GIF, "image/gif"),
        (WEBP, "image/webp"), (MP4, "video/mp4"), (WEBM, "video/webm"),
    ]:
        res = upload(client, data)
        assert res.status_code == 201, expected
        assert res.json()["mime"] == expected


def test_html_dressed_up_as_an_image_is_refused(client):
    """The declared type and the filename are the client's to choose. Serving
    a stored HTML file back would be stored XSS."""
    register(client, "euan")
    login(client, "euan")

    res = upload(client, HTML, name="innocent.png", ctype="image/png")
    assert res.status_code == 400


def test_a_binary_is_refused(client):
    register(client, "euan")
    login(client, "euan")
    assert upload(client, ELF, name="x.png", ctype="image/png").status_code == 400


def test_an_empty_file_is_refused(client):
    register(client, "euan")
    login(client, "euan")
    assert upload(client, b"", name="x.png").status_code == 400


def test_the_stored_type_comes_from_the_bytes_not_the_header(client):
    register(client, "euan")
    login(client, "euan")

    res = upload(client, PNG, name="lies.jpg", ctype="image/jpeg")
    assert res.json()["mime"] == "image/png"


# --------------------------------------------------------------------------
# Path handling
# --------------------------------------------------------------------------

def test_a_traversal_filename_cannot_escape_the_media_directory(client):
    """The stored path comes from our own random id, so a hostile filename has
    nowhere to go. It is kept only for display."""
    from app import storage

    register(client, "euan")
    login(client, "euan")

    res = upload(client, PNG, name="../../../../etc/passwd.png")
    assert res.status_code == 201

    stored = storage.path_for(res.json()["id"], "image/png").resolve()
    assert storage.media_root().resolve() in stored.parents


def test_two_uploads_of_the_same_bytes_get_different_ids(client):
    register(client, "euan")
    login(client, "euan")

    first = upload(client, PNG).json()
    second = upload(client, PNG).json()
    assert first["id"] != second["id"]
    # Same content, so the same digest — that is what dedup would key on later.
    assert first["url"] != second["url"]


# --------------------------------------------------------------------------
# Size and quota
# --------------------------------------------------------------------------

def test_an_oversized_image_is_refused(client):
    from app.config import get_settings

    register(client, "euan")
    login(client, "euan")
    oversized = PNG + b"\x00" * get_settings().max_image_bytes

    assert upload(client, oversized).status_code == 413


def test_the_quota_is_enforced(client, monkeypatch):
    from app.config import get_settings

    register(client, "euan")
    login(client, "euan")

    settings = get_settings()
    monkeypatch.setattr(settings, "storage_quota_bytes", 200)

    assert upload(client, PNG + b"\x00" * 100).status_code == 201
    assert upload(client, PNG + b"\x00" * 100).status_code == 413


def test_deleting_frees_the_quota(client, monkeypatch):
    from app.config import get_settings

    register(client, "euan")
    login(client, "euan")
    settings = get_settings()
    monkeypatch.setattr(settings, "storage_quota_bytes", 200)

    first = upload(client, PNG + b"\x00" * 100).json()
    assert upload(client, PNG + b"\x00" * 100).status_code == 413

    client.delete(f"/api/v1/media/{first['id']}")
    assert upload(client, PNG + b"\x00" * 100).status_code == 201


def test_quota_reports_what_is_stored(client):
    register(client, "euan")
    login(client, "euan")
    grant("euan", video=True)
    upload(client, PNG)
    upload(client, MP4, name="a.mp4")

    body = client.get("/api/v1/media/quota").json()
    assert body["images"] == 1
    assert body["videos"] == 1
    assert body["used_bytes"] == len(PNG) + len(MP4)


# --------------------------------------------------------------------------
# Reading a file back
# --------------------------------------------------------------------------

def test_a_private_upload_is_not_readable_by_a_stranger(client):
    register(client, "euan")
    login(client, "euan")
    media_id = upload(client, PNG).json()["id"]
    client.post("/api/v1/auth/logout")

    assert client.get(f"/api/v1/media/{media_id}").status_code == 404


def test_a_private_upload_is_not_readable_by_another_user(client):
    register(client, "alice")
    register(client, "euan")
    login(client, "euan")
    media_id = upload(client, PNG).json()["id"]
    client.post("/api/v1/auth/logout")

    login(client, "alice")
    assert client.get(f"/api/v1/media/{media_id}").status_code == 404


def test_the_owner_can_read_their_own_private_upload(client):
    register(client, "euan")
    login(client, "euan")
    media_id = upload(client, PNG).json()["id"]

    res = client.get(f"/api/v1/media/{media_id}")
    assert res.status_code == 200
    assert res.content == PNG


def test_a_public_upload_is_readable_by_anyone(client):
    register(client, "euan")
    login(client, "euan")
    media_id = upload(client, PNG, visibility="public").json()["id"]
    client.post("/api/v1/auth/logout")

    res = client.get(f"/api/v1/media/{media_id}")
    assert res.status_code == 200
    assert res.content == PNG


def test_a_missing_id_and_a_forbidden_one_look_the_same(client):
    register(client, "euan")
    login(client, "euan")
    media_id = upload(client, PNG).json()["id"]
    client.post("/api/v1/auth/logout")

    forbidden = client.get(f"/api/v1/media/{media_id}")
    missing = client.get("/api/v1/media/does-not-exist-at-all")
    assert forbidden.status_code == missing.status_code == 404
    assert forbidden.json() == missing.json()


def test_uploads_default_to_private(client):
    register(client, "euan")
    login(client, "euan")
    assert upload(client, PNG).json()["visibility"] == "private"


def test_the_response_forbids_content_type_sniffing(client):
    register(client, "euan")
    login(client, "euan")
    media_id = upload(client, PNG, visibility="public").json()["id"]

    res = client.get(f"/api/v1/media/{media_id}")
    assert res.headers["X-Content-Type-Options"] == "nosniff"
    assert res.headers["Content-Type"] == "image/png"


# --------------------------------------------------------------------------
# Visibility and deletion
# --------------------------------------------------------------------------

def test_the_owner_can_publish_a_file(client):
    register(client, "euan")
    login(client, "euan")
    media_id = upload(client, PNG).json()["id"]

    client.patch(f"/api/v1/media/{media_id}", params={"visibility": "public"})
    client.post("/api/v1/auth/logout")
    assert client.get(f"/api/v1/media/{media_id}").status_code == 200


def test_only_the_owner_can_change_visibility(client):
    register(client, "alice")
    register(client, "euan")
    login(client, "euan")
    media_id = upload(client, PNG).json()["id"]
    client.post("/api/v1/auth/logout")

    login(client, "alice")
    res = client.patch(f"/api/v1/media/{media_id}", params={"visibility": "public"})
    assert res.status_code == 404


def test_deleting_removes_the_bytes_from_disk(client):
    from app import storage

    register(client, "euan")
    login(client, "euan")
    body = upload(client, PNG).json()
    path = storage.path_for(body["id"], "image/png")
    assert path.is_file()

    assert client.delete(f"/api/v1/media/{body['id']}").status_code == 204
    # The row is soft-deleted, but the bytes really are gone: keeping them
    # after the user asked for removal would be the wrong half to preserve.
    assert not path.is_file()
    assert client.get(f"/api/v1/media/{body['id']}").status_code == 404


def test_only_the_owner_can_delete(client):
    register(client, "alice")
    register(client, "euan")
    login(client, "euan")
    media_id = upload(client, PNG).json()["id"]
    client.post("/api/v1/auth/logout")

    login(client, "alice")
    assert client.delete(f"/api/v1/media/{media_id}").status_code == 404


def test_the_listing_shows_only_your_own(client):
    register(client, "alice")
    register(client, "euan")

    login(client, "alice")
    upload(client, PNG)
    client.post("/api/v1/auth/logout")

    login(client, "euan")
    upload(client, JPEG)
    rows = client.get("/api/v1/media").json()
    assert len(rows) == 1
    assert rows[0]["mime"] == "image/jpeg"


def test_a_deleted_file_leaves_the_listing(client):
    register(client, "euan")
    login(client, "euan")
    media_id = upload(client, PNG).json()["id"]
    client.delete(f"/api/v1/media/{media_id}")

    assert client.get("/api/v1/media").json() == []
