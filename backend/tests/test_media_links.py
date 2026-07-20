"""Media belongs to content: attaching, releasing, and sweeping orphans.

The association is derived from the body on every save. Nothing asks the client
to declare it, so no path can forget to — that is the whole point.
"""

import io
from datetime import datetime, timedelta, timezone

from tests.conftest import current_session, login, make_content, register

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


def upload(client) -> dict:
    return client.post(
        "/api/v1/media", files={"file": ("a.png", io.BytesIO(PNG), "image/png")}
    ).json()


def media_row(media_id: str):
    from app.models import MediaFile

    with current_session() as db:
        m = db.get(MediaFile, media_id)
        # Detached copy of what matters, so the session can close.
        return None if m is None else {
            "content_id": m.content_id,
            "orphaned_at": m.orphaned_at,
            "deleted_at": m.deleted_at,
        }


def age(media_id: str, *, orphaned_days: float | None = None, created_hours: float | None = None):
    """Backdates a file so the sweep sees it as expired."""
    from app.models import MediaFile

    with current_session() as db:
        m = db.get(MediaFile, media_id)
        now = datetime.now(timezone.utc)
        if orphaned_days is not None:
            m.orphaned_at = now - timedelta(days=orphaned_days)
        if created_hours is not None:
            m.created_at = now - timedelta(hours=created_hours)
        db.commit()


# --------------------------------------------------------------------------
# Attaching
# --------------------------------------------------------------------------

def test_a_fresh_upload_belongs_to_nothing(client):
    register(client, "euan")
    login(client, "euan")
    media = upload(client)
    assert media_row(media["id"])["content_id"] is None


def test_saving_content_attaches_what_the_body_points_at(client):
    register(client, "euan")
    login(client, "euan")
    media = upload(client)

    item = make_content(client, body=f"看这张图 ![](/api/v1/media/{media['id']})")
    assert media_row(media["id"])["content_id"] == item["id"]


def test_a_cover_counts_as_a_reference(client):
    register(client, "euan")
    login(client, "euan")
    media = upload(client)

    item = make_content(client, body="正文", cover=f"/api/v1/media/{media['id']}")
    assert media_row(media["id"])["content_id"] == item["id"]


def test_editing_a_body_in_attaches_a_new_file(client):
    register(client, "euan")
    login(client, "euan")
    item = make_content(client, body="还没有图")
    media = upload(client)

    client.patch(f"/api/v1/content/{item['id']}", json={
        "body": f"现在有了 ![](/api/v1/media/{media['id']})"})
    assert media_row(media["id"])["content_id"] == item["id"]


def test_you_cannot_claim_someone_else_s_file_by_linking_to_it(client):
    """Referencing an id in your body must not give you a claim on it."""
    register(client, "alice")
    login(client, "alice")
    theirs = upload(client)
    client.post("/api/v1/auth/logout")

    register(client, "euan")
    login(client, "euan")
    make_content(client, body=f"偷一张 ![](/api/v1/media/{theirs['id']})")

    assert media_row(theirs["id"])["content_id"] is None


# --------------------------------------------------------------------------
# Releasing
# --------------------------------------------------------------------------

def test_removing_an_image_from_the_body_releases_it(client):
    register(client, "euan")
    login(client, "euan")
    media = upload(client)
    item = make_content(client, body=f"![](/api/v1/media/{media['id']})")

    client.patch(f"/api/v1/content/{item['id']}", json={"body": "图没了"})

    row = media_row(media["id"])
    assert row["content_id"] is None
    # Marked, not deleted — an edit made by mistake can still be undone.
    assert row["orphaned_at"] is not None
    assert row["deleted_at"] is None


def test_putting_it_back_re_attaches_it(client):
    register(client, "euan")
    login(client, "euan")
    media = upload(client)
    item = make_content(client, body=f"![](/api/v1/media/{media['id']})")
    client.patch(f"/api/v1/content/{item['id']}", json={"body": "图没了"})

    client.patch(f"/api/v1/content/{item['id']}", json={
        "body": f"回来了 ![](/api/v1/media/{media['id']})"})

    row = media_row(media["id"])
    assert row["content_id"] == item["id"]
    assert row["orphaned_at"] is None


def test_trashing_content_orphans_its_files_but_keeps_them(client):
    """Restoring a note with its images missing would be the worse outcome."""
    register(client, "euan")
    login(client, "euan")
    media = upload(client)
    item = make_content(client, body=f"![](/api/v1/media/{media['id']})")

    client.delete(f"/api/v1/content/{item['id']}")

    row = media_row(media["id"])
    assert row["orphaned_at"] is not None
    assert row["deleted_at"] is None


def test_restoring_content_re_attaches_its_files(client):
    register(client, "euan")
    login(client, "euan")
    media = upload(client)
    item = make_content(client, body=f"![](/api/v1/media/{media['id']})")
    client.delete(f"/api/v1/content/{item['id']}")

    client.post(f"/api/v1/trash/{item['id']}/restore")

    row = media_row(media["id"])
    assert row["content_id"] == item["id"]
    assert row["orphaned_at"] is None


def test_purging_content_deletes_its_files(client):
    from app import storage

    register(client, "euan")
    login(client, "euan")
    media = upload(client)
    item = make_content(client, body=f"![](/api/v1/media/{media['id']})")
    client.delete(f"/api/v1/content/{item['id']}")

    client.delete(f"/api/v1/trash/{item['id']}")

    assert media_row(media["id"])["deleted_at"] is not None
    # Nothing left to restore into, so the bytes go too.
    assert not storage.path_for(media["id"], "image/png").is_file()


def test_emptying_the_bin_deletes_the_files_too(client):
    register(client, "euan")
    login(client, "euan")
    media = upload(client)
    item = make_content(client, body=f"![](/api/v1/media/{media['id']})")
    client.delete(f"/api/v1/content/{item['id']}")

    client.delete("/api/v1/trash")

    assert media_row(media["id"])["deleted_at"] is not None


# --------------------------------------------------------------------------
# The sweep — what stops orphans accumulating
# --------------------------------------------------------------------------

def test_the_sweep_leaves_attached_files_alone(client):
    from app import media_links

    register(client, "euan")
    login(client, "euan")
    media = upload(client)
    make_content(client, body=f"![](/api/v1/media/{media['id']})")

    with current_session() as db:
        assert media_links.sweep(db) == 0
    assert media_row(media["id"])["deleted_at"] is None


def test_the_sweep_leaves_a_recent_orphan_alone(client):
    from app import media_links

    register(client, "euan")
    login(client, "euan")
    media = upload(client)
    item = make_content(client, body=f"![](/api/v1/media/{media['id']})")
    client.patch(f"/api/v1/content/{item['id']}", json={"body": "图没了"})

    with current_session() as db:
        assert media_links.sweep(db) == 0


def test_the_sweep_removes_an_expired_orphan(client):
    from app import media_links, storage

    register(client, "euan")
    login(client, "euan")
    media = upload(client)
    item = make_content(client, body=f"![](/api/v1/media/{media['id']})")
    client.patch(f"/api/v1/content/{item['id']}", json={"body": "图没了"})
    age(media["id"], orphaned_days=8)

    with current_session() as db:
        assert media_links.sweep(db) == 1

    assert media_row(media["id"])["deleted_at"] is not None
    assert not storage.path_for(media["id"], "image/png").is_file()


def test_the_sweep_leaves_a_fresh_unattached_upload_alone(client):
    """Somebody may still be writing the note it is going into."""
    from app import media_links

    register(client, "euan")
    login(client, "euan")
    upload(client)

    with current_session() as db:
        assert media_links.sweep(db) == 0


def test_the_sweep_removes_an_abandoned_upload(client):
    from app import media_links

    register(client, "euan")
    login(client, "euan")
    media = upload(client)
    age(media["id"], created_hours=48)

    with current_session() as db:
        assert media_links.sweep(db) == 1


def test_sweeping_frees_the_quota(client):
    from app import media_links

    register(client, "euan")
    login(client, "euan")
    media = upload(client)
    age(media["id"], created_hours=48)
    assert client.get("/api/v1/media/quota").json()["images"] == 1

    with current_session() as db:
        media_links.sweep(db)

    assert client.get("/api/v1/media/quota").json()["images"] == 0


# --------------------------------------------------------------------------
# Admin visibility
# --------------------------------------------------------------------------

def test_the_admin_can_see_and_run_the_sweep(client):
    from tests.test_admin import sign_in_as_admin

    register(client, "euan")
    login(client, "euan")
    media = upload(client)
    age(media["id"], created_hours=48)
    client.post("/api/v1/auth/logout")

    sign_in_as_admin(client)
    assert client.get("/api/v1/admin/media/orphans").json()["never_attached"] == 1
    assert client.post("/api/v1/admin/media/sweep").json()["removed"] == 1
    assert client.get("/api/v1/admin/media/orphans").json()["never_attached"] == 0


def test_an_ordinary_user_cannot_trigger_the_sweep(client):
    register(client, "euan")
    login(client, "euan")
    assert client.post("/api/v1/admin/media/sweep").status_code == 404
