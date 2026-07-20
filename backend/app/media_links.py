from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from . import storage
from .config import get_settings
from .models import Content, MediaFile

"""
Which files belong to which content.

The association is **derived from the content itself**, not declared by the
client. Every save re-reads the body and cover and works out what they point
at. That is deliberate: if attaching were a separate call the client had to
remember, every path that forgot it would quietly create an orphan — and
orphans are exactly what this is meant to prevent (the same reasoning as
ADR-002: make the correct thing the default rather than something to remember).

Losing a reference does not delete the file straight away. It is marked
orphaned and swept later, so an edit made by mistake can be undone.
"""

# Matches the URLs the editor inserts: `/api/v1/media/<id>`, with or without a
# host in front, and stopping at whatever punctuation follows in Markdown.
_MEDIA_REF = re.compile(r"/api/v1/media/([A-Za-z0-9_-]{8,64})")


def referenced_ids(*texts: str | None) -> set[str]:
    """Every media id mentioned across the given fields."""
    found: set[str] = set()
    for text in texts:
        if text:
            found.update(_MEDIA_REF.findall(text))
    return found


def reconcile(db: Session, content: Content) -> None:
    """Points the right files at this content, and releases the rest.

    Called on every content save. Only the author's own files can be attached:
    referencing somebody else's id in your body must not give you a claim on
    their file.
    """
    wanted = referenced_ids(content.body, content.cover)
    now = datetime.now(timezone.utc)

    # Attach — but only files this author owns.
    if wanted:
        rows = db.scalars(
            select(MediaFile).where(
                MediaFile.id.in_(wanted),
                MediaFile.owner_id == content.author_id,
                MediaFile.deleted_at.is_(None),
            )
        ).all()
        for media in rows:
            media.content_id = content.id
            media.orphaned_at = None

    # Release anything that used to be here and no longer is.
    stale = db.scalars(
        select(MediaFile).where(
            MediaFile.content_id == content.id,
            MediaFile.deleted_at.is_(None),
        )
    ).all()
    for media in stale:
        if media.id not in wanted:
            media.content_id = None
            media.orphaned_at = now


def release_for_content(db: Session, content_id: str) -> None:
    """Marks a content's files orphaned. Used when the content is trashed.

    Not a delete: trashed content can be restored, and restoring it with its
    images missing would be a worse outcome than keeping the bytes a week.
    """
    now = datetime.now(timezone.utc)
    for media in db.scalars(
        select(MediaFile).where(
            MediaFile.content_id == content_id, MediaFile.deleted_at.is_(None)
        )
    ).all():
        media.orphaned_at = now


def purge_for_content(db: Session, content_id: str) -> int:
    """Deletes a content's files outright. Used when the content is purged.

    Once the content is gone for good there is nothing left to restore into,
    so keeping the bytes would just be an orphan by another name.
    """
    rows = db.scalars(
        select(MediaFile).where(
            MediaFile.content_id == content_id, MediaFile.deleted_at.is_(None)
        )
    ).all()
    now = datetime.now(timezone.utc)
    for media in rows:
        storage.remove(media.id, media.mime)
        media.deleted_at = now
        media.content_id = None
    return len(rows)


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def sweep(db: Session) -> int:
    """Removes files nothing references any more. Returns how many went.

    Two windows, because the two cases are not equally risky:

    * **Orphaned** — it was in a note and the note stopped mentioning it. Kept
      for a week, so an accidental edit can be undone.
    * **Never attached** — uploaded and then the editor was abandoned. Kept a
      day; nothing is losing anything.
    """
    settings = get_settings()
    now = datetime.now(timezone.utc)
    orphan_cutoff = now - timedelta(days=settings.media_orphan_retention_days)
    unattached_cutoff = now - timedelta(hours=settings.media_unattached_retention_hours)

    candidates = db.scalars(
        select(MediaFile).where(
            MediaFile.deleted_at.is_(None),
            MediaFile.content_id.is_(None),
            or_(MediaFile.orphaned_at.is_not(None), MediaFile.orphaned_at.is_(None)),
        )
    ).all()

    removed = 0
    for media in candidates:
        orphaned = _aware(media.orphaned_at)
        created = _aware(media.created_at)

        if orphaned is not None:
            expired = orphaned < orphan_cutoff
        else:
            # Never attached to anything.
            expired = created is not None and created < unattached_cutoff

        if expired:
            storage.remove(media.id, media.mime)
            media.deleted_at = now
            removed += 1

    if removed:
        db.commit()
    return removed
