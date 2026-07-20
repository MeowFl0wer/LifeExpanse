"""Query and mutation helpers shared by the routers.

Every read applies the visibility rule and every write applies the ownership
rule here, so an endpoint cannot forget one. The frontend performs the same
checks for its own UI, but these are the ones that actually protect the data.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .models import Content, Folder, Series, Tag, User, utcnow
from .schemas import ContentOut

NOT_FOUND = "内容不存在"


def slugify(title: str, fallback: str) -> str:
    ascii_slug = re.sub(r"[^a-z0-9]+", "-", title.strip().lower()).strip("-")
    return ascii_slug or fallback


def unique_slug(db: Session, author_id: str, base: str) -> str:
    """Slugs address content, so they must be unique per author."""
    candidate = base or "entry"
    n = 1
    while db.scalar(
        select(Content.id).where(Content.author_id == author_id, Content.slug == candidate)
    ):
        n += 1
        candidate = f"{base}-{n}"
    return candidate


def get_user_by_username(db: Session, username: str) -> User:
    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    return user


def visible_to(item: Content, viewer: User | None) -> bool:
    if item.deleted_at is not None:
        return False
    if item.visibility == "public":
        return True
    return viewer is not None and viewer.id == item.author_id


def live_content_query(author_id: str, viewer: User | None):
    """Base query: not deleted, and visible to this viewer."""
    stmt = select(Content).where(
        Content.author_id == author_id,
        Content.deleted_at.is_(None),
    )
    if viewer is None or viewer.id != author_id:
        stmt = stmt.where(Content.visibility == "public")
    return stmt


def owned_content(db: Session, content_id: str, actor: User) -> Content:
    """Loads content the actor may modify.

    Not-found and not-yours return the same 404 so the response cannot be used
    to discover which ids exist.
    """
    item = db.get(Content, content_id)
    if item is None or item.author_id != actor.id or item.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=NOT_FOUND)
    return item


def owned_folder(db: Session, folder_id: str, actor: User) -> Folder:
    folder = db.get(Folder, folder_id)
    if folder is None or folder.owner_id != actor.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件夹不存在")
    return folder


def owned_series(db: Session, series_id: str, actor: User) -> Series:
    entry = db.get(Series, series_id)
    if entry is None or entry.owner_id != actor.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="系列不存在")
    return entry


def set_tags(db: Session, item: Content, names: list[str]) -> None:
    item.tags.clear()
    db.flush()
    seen: set[str] = set()
    for raw in names:
        name = raw.strip().lstrip("#")
        if not name or name in seen:
            continue
        seen.add(name)
        item.tags.append(Tag(name=name))


def apply_membership(
    db: Session, item: Content, actor: User, folder_ids: list[str], series_ids: list[str]
) -> None:
    """Files content into folders and series, enforcing the hierarchy rule.

    A note reached through a folder that already belongs to series S is not
    also filed directly into S, so it can never appear loose beside its folder.
    """
    folders = [owned_folder(db, fid, actor) for fid in dict.fromkeys(folder_ids)]
    inherited = {s.id for f in folders for s in f.series}
    series = [
        owned_series(db, sid, actor)
        for sid in dict.fromkeys(series_ids)
        if sid not in inherited
    ]
    item.folders = folders
    item.series = series


def to_out(item: Content) -> ContentOut:
    return ContentOut(
        id=item.id,
        slug=item.slug,
        type=item.type,
        content_kind=item.content_kind,
        thought_type=item.thought_type,
        title=item.title,
        body=item.body,
        summary=item.summary,
        visibility=item.visibility,
        author=item.author.username,
        tags=[t.name for t in item.tags],
        folder_ids=[f.id for f in item.folders],
        series_ids=[s.id for s in item.series],
        category=item.category,
        cover=item.cover,
        seo_title=item.seo_title,
        seo_description=item.seo_description,
        allow_comments=item.allow_comments,
        favorite=item.favorite,
        archived=item.archived,
        source_author=item.source_author,
        source_title=item.source_title,
        source_type=item.source_type,
        source_url=item.source_url,
        source_locator=item.source_locator,
        created_at=item.created_at,
        updated_at=item.updated_at,
        published_at=item.published_at,
    )


def trash_days_remaining(deleted_at: datetime) -> int:
    retention = timedelta(days=get_settings().trash_retention_days)
    expires = deleted_at.replace(tzinfo=timezone.utc) + retention
    left = (expires - datetime.now(timezone.utc)).days
    return max(0, left)


def purge_expired(db: Session) -> int:
    """Removes anything past its retention window."""
    cutoff = utcnow() - timedelta(days=get_settings().trash_retention_days)
    stale = db.scalars(
        select(Content).where(Content.deleted_at.is_not(None), Content.deleted_at < cutoff)
    ).all()
    for item in stale:
        db.delete(item)
    if stale:
        db.commit()
    return len(stale)
