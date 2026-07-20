from __future__ import annotations

import logging

from sqlalchemy import select

from . import storage
from .db import SessionLocal
from .models import MediaFile

log = logging.getLogger("lifeexpanse.thumbnails")

"""
Thumbnail and poster generation, off the request path.

Decoding a 200 MB video takes seconds. Making the uploader wait for a picture
they have not asked to see is the wrong trade, so generation runs after the
response has gone out.

That introduces a failure mode a synchronous version did not have: the process
can die between the response and the work. `backfill` is the answer — it runs
at startup and picks up anything still pending, so a crash costs a retry rather
than a thumbnail that is missing forever.

Until one exists, `?variant=thumb` falls back to the original. The page is
correct throughout, just not as cheap for a moment.
"""


def generate_for(media_id: str) -> None:
    """Generates one file's thumbnail. Opens its own session.

    Background tasks outlive the request, and with it the request's session —
    so this cannot borrow that one.

    Nothing raised here can reach a caller: the response has already gone out,
    so an exception would only crash a worker thread over a picture. Anything
    that fails is left `pending`/`failed` for the startup pass to retry.
    """
    try:
        _generate(media_id)
    except Exception:
        log.exception("thumbnail generation failed for %s", media_id)


def _generate(media_id: str) -> None:
    with SessionLocal() as db:
        media = db.get(MediaFile, media_id)
        if media is None or media.deleted_at is not None:
            return

        data = storage.load(media.id, media.mime)
        if data is None:
            media.thumbnail_state = "failed"
            db.commit()
            return

        try:
            made = storage.make_thumbnail(media.id, media.mime, data)
        except Exception:
            log.exception("thumbnail generation failed for %s", media.id)
            media.thumbnail_state = "failed"
            db.commit()
            return

        media.has_thumbnail = made
        # "skipped" is not a failure: an image already smaller than the target
        # edge has nothing to gain from one, and retrying it forever would be
        # pointless work on every startup.
        media.thumbnail_state = "ready" if made else "skipped"
        db.commit()


def backfill(limit: int = 200) -> int:
    """Processes anything still pending or previously failed.

    Runs at startup. The limit keeps a boot from stalling on a large backlog;
    the next start picks up where this one left off.
    """
    with SessionLocal() as db:
        pending = db.scalars(
            select(MediaFile)
            .where(
                MediaFile.deleted_at.is_(None),
                MediaFile.thumbnail_state.in_(("pending", "failed")),
            )
            .order_by(MediaFile.created_at)
            .limit(limit)
        ).all()
        ids = [m.id for m in pending]

    for media_id in ids:
        generate_for(media_id)

    if ids:
        log.info("generated %d pending thumbnails", len(ids))
    return len(ids)
