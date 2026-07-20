"""Uploads: permissions, type checking, quota, and who may read a file back."""

import io
import os

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


# --------------------------------------------------------------------------
# Thumbnails — display never pulls the original
# --------------------------------------------------------------------------

def big_png(width=1600, height=1200) -> bytes:
    """A real image, large enough that a thumbnail is worth making."""
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (width, height), (120, 160, 140)).save(buf, "PNG")
    return buf.getvalue()


def test_a_large_image_gets_a_thumbnail(client):
    register(client, "euan")
    login(client, "euan")

    body = upload(client, big_png()).json()
    assert body["has_thumbnail"] is True
    assert body["thumbnail_url"].endswith("?variant=thumb")


def test_the_thumbnail_is_much_smaller_than_the_original(client):
    register(client, "euan")
    login(client, "euan")
    media_id = upload(client, big_png()).json()["id"]

    original = client.get(f"/api/v1/media/{media_id}")
    thumb = client.get(f"/api/v1/media/{media_id}", params={"variant": "thumb"})

    assert thumb.status_code == 200
    assert thumb.headers["Content-Type"] == "image/webp"
    # The whole point: a page of photos must not pull full-size files.
    assert len(thumb.content) < len(original.content) / 2


def test_the_thumbnail_is_bounded_by_the_configured_edge(client):
    from PIL import Image
    from app.config import get_settings

    register(client, "euan")
    login(client, "euan")
    media_id = upload(client, big_png()).json()["id"]

    thumb = client.get(f"/api/v1/media/{media_id}", params={"variant": "thumb"})
    with Image.open(io.BytesIO(thumb.content)) as img:
        assert max(img.size) <= get_settings().thumbnail_max_edge


def test_a_small_image_gets_no_thumbnail(client):
    """There would be nothing saved, so none is made."""
    register(client, "euan")
    login(client, "euan")

    body = upload(client, big_png(80, 60)).json()
    assert body["has_thumbnail"] is False
    assert body["thumbnail_url"] == ""


def test_asking_for_a_thumbnail_that_does_not_exist_returns_the_original(client):
    """The caller wanted the picture; 404ing on the variant would be unhelpful."""
    register(client, "euan")
    login(client, "euan")
    media_id = upload(client, big_png(80, 60)).json()["id"]

    res = client.get(f"/api/v1/media/{media_id}", params={"variant": "thumb"})
    assert res.status_code == 200
    assert res.headers["Content-Type"] == "image/png"


def test_a_thumbnail_obeys_the_same_permissions_as_the_original(client):
    register(client, "euan")
    login(client, "euan")
    media_id = upload(client, big_png()).json()["id"]
    client.post("/api/v1/auth/logout")

    assert client.get(f"/api/v1/media/{media_id}", params={"variant": "thumb"}).status_code == 404


def test_downloading_offers_the_file_as_an_attachment(client):
    register(client, "euan")
    login(client, "euan")
    media_id = upload(client, big_png(), name="holiday.png").json()["id"]

    res = client.get(f"/api/v1/media/{media_id}", params={"download": "true"})
    assert res.status_code == 200
    assert res.headers["Content-Disposition"].startswith("attachment")
    assert "holiday.png" in res.headers["Content-Disposition"]


def test_a_hostile_filename_cannot_break_the_disposition_header(client):
    register(client, "euan")
    login(client, "euan")
    media_id = upload(client, big_png(), name='evil".png').json()["id"]

    res = client.get(f"/api/v1/media/{media_id}", params={"download": "true"})
    header = res.headers["Content-Disposition"]
    # The quote is stripped, so the header stays one well-formed value.
    assert header.count('"') == 2


def test_deleting_removes_the_thumbnail_too(client):
    from app import storage

    register(client, "euan")
    login(client, "euan")
    media_id = upload(client, big_png()).json()["id"]
    thumb = storage.thumb_path_for(media_id, "image/png")
    assert thumb.is_file()

    client.delete(f"/api/v1/media/{media_id}")
    assert not thumb.is_file()


# --------------------------------------------------------------------------
# Video posters
# --------------------------------------------------------------------------

def make_video(seconds: float = 3, colour: str = "green") -> bytes:
    """A real, decodable MP4. Sniffing and ffmpeg both look at the actual bytes,
    so a fake header would not exercise either."""
    import subprocess
    import tempfile

    import imageio_ffmpeg

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as handle:
        path = handle.name
    subprocess.run(
        [
            imageio_ffmpeg.get_ffmpeg_exe(), "-loglevel", "error",
            "-f", "lavfi", "-i", f"color=c={colour}:s=640x480:d={seconds}",
            "-pix_fmt", "yuv420p", "-y", path,
        ],
        check=True, capture_output=True, timeout=60,
    )
    data = open(path, "rb").read()
    os.unlink(path)
    return data


def test_a_video_gets_a_poster_frame(client):
    register(client, "euan")
    login(client, "euan")
    grant("euan", video=True)

    body = upload(client, make_video(), name="clip.mp4", ctype="video/mp4").json()
    assert body["kind"] == "video"
    # Without one, a page of clips is a page of grey rectangles.
    assert body["has_thumbnail"] is True
    assert body["thumbnail_url"].endswith("?variant=thumb")


def test_the_poster_is_an_image_not_the_video(client):
    register(client, "euan")
    login(client, "euan")
    grant("euan", video=True)
    media_id = upload(client, make_video(), name="clip.mp4", ctype="video/mp4").json()["id"]

    poster = client.get(f"/api/v1/media/{media_id}", params={"variant": "thumb"})
    assert poster.status_code == 200
    assert poster.headers["Content-Type"] == "image/webp"
    # And the original is still the video.
    original = client.get(f"/api/v1/media/{media_id}")
    assert original.headers["Content-Type"] == "video/mp4"
    assert len(poster.content) < len(original.content)


def test_a_very_short_clip_still_gets_a_poster(client):
    """The first attempt seeks to one second; a shorter clip has no frame there."""
    register(client, "euan")
    login(client, "euan")
    grant("euan", video=True)

    body = upload(client, make_video(seconds=0.3), name="tiny.mp4", ctype="video/mp4").json()
    assert body["has_thumbnail"] is True


def test_deleting_a_video_removes_its_poster(client):
    from app import storage

    register(client, "euan")
    login(client, "euan")
    grant("euan", video=True)
    media_id = upload(client, make_video(), name="clip.mp4", ctype="video/mp4").json()["id"]
    poster = storage.thumb_path_for(media_id, "video/mp4")
    assert poster.is_file()

    client.delete(f"/api/v1/media/{media_id}")
    assert not poster.is_file()


def test_a_poster_obeys_the_same_permissions_as_the_video(client):
    register(client, "euan")
    login(client, "euan")
    grant("euan", video=True)
    media_id = upload(client, make_video(), name="clip.mp4", ctype="video/mp4").json()["id"]
    client.post("/api/v1/auth/logout")

    assert client.get(f"/api/v1/media/{media_id}", params={"variant": "thumb"}).status_code == 404


# --------------------------------------------------------------------------
# Animated images
# --------------------------------------------------------------------------

def animated_gif(width=1200, height=900, frames=4) -> bytes:
    from PIL import Image

    palette = [(220, 60, 60), (60, 200, 90), (60, 120, 220), (230, 190, 60)]
    images = [
        Image.new("RGB", (width, height), palette[i % len(palette)]).convert("P")
        for i in range(frames)
    ]
    buf = io.BytesIO()
    images[0].save(
        buf, "GIF", save_all=True, append_images=images[1:], duration=120, loop=0
    )
    return buf.getvalue()


def test_an_animated_gif_keeps_its_animation_in_the_thumbnail(client):
    """A still first frame would make every animation look broken until clicked."""
    from PIL import Image

    register(client, "euan")
    login(client, "euan")
    media_id = upload(client, animated_gif(), name="a.gif", ctype="image/gif").json()["id"]

    thumb = client.get(f"/api/v1/media/{media_id}", params={"variant": "thumb"})
    with Image.open(io.BytesIO(thumb.content)) as img:
        assert img.format == "WEBP"
        assert getattr(img, "n_frames", 1) > 1


def test_a_small_animated_gif_still_gets_a_thumbnail(client):
    """Size is not the only reason: a GIF needs converting to animated WebP
    even when its dimensions are already small."""
    register(client, "euan")
    login(client, "euan")

    body = upload(client, animated_gif(80, 60), name="a.gif", ctype="image/gif").json()
    assert body["has_thumbnail"] is True
