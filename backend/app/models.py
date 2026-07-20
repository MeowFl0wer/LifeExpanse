from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer, String, Table, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def new_id() -> str:
    return uuid.uuid4().hex


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# Content may sit in several folders, and a folder in several series.
content_folders = Table(
    "content_folders", Base.metadata,
    Column("content_id", ForeignKey("contents.id", ondelete="CASCADE"), primary_key=True),
    Column("folder_id", ForeignKey("folders.id", ondelete="CASCADE"), primary_key=True),
)

content_series = Table(
    "content_series", Base.metadata,
    Column("content_id", ForeignKey("contents.id", ondelete="CASCADE"), primary_key=True),
    Column("series_id", ForeignKey("series.id", ondelete="CASCADE"), primary_key=True),
)

folder_series = Table(
    "folder_series", Base.metadata,
    Column("folder_id", ForeignKey("folders.id", ondelete="CASCADE"), primary_key=True),
    Column("series_id", ForeignKey("series.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    username: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(60), default="")
    bio: Mapped[str] = mapped_column(Text, default="")
    # Argon2id via passlib; the plain password is never stored or logged.
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    contents: Mapped[list[Content]] = relationship(back_populates="author", cascade="all, delete-orphan")


class Content(Base):
    """Thoughts, diary entries, notes and articles share one table."""

    __tablename__ = "contents"
    __table_args__ = (UniqueConstraint("author_id", "slug", name="uq_author_slug"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    slug: Mapped[str] = mapped_column(String(200), index=True)

    # thought | diary | pkm
    type: Mapped[str] = mapped_column(String(16), index=True)
    # note | article, only for type == pkm
    content_kind: Mapped[str | None] = mapped_column(String(16), nullable=True)
    # original | excerpt, only for type == thought
    thought_type: Mapped[str | None] = mapped_column(String(16), nullable=True)

    title: Mapped[str] = mapped_column(String(300), default="")
    body: Mapped[str] = mapped_column(Text, default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    # public | private | draft — enforced on every read, server side.
    visibility: Mapped[str] = mapped_column(String(16), default="private", index=True)

    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cover: Mapped[str | None] = mapped_column(String(500), nullable=True)
    seo_title: Mapped[str | None] = mapped_column(String(300), nullable=True)
    seo_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    allow_comments: Mapped[bool] = mapped_column(Boolean, default=False)
    favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)

    source_author: Mapped[str | None] = mapped_column(String(200), nullable=True)
    source_title: Mapped[str | None] = mapped_column(String(300), nullable=True)
    source_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    source_locator: Mapped[str | None] = mapped_column(String(200), nullable=True)
    personal_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Soft delete: the recycle bin. Non-null means it is in the bin.
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)

    author: Mapped[User] = relationship(back_populates="contents")
    tags: Mapped[list[Tag]] = relationship(cascade="all, delete-orphan", back_populates="content")
    folders: Mapped[list[Folder]] = relationship(secondary=content_folders, back_populates="contents")
    series: Mapped[list[Series]] = relationship(secondary=content_series, back_populates="contents")


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    content_id: Mapped[str] = mapped_column(ForeignKey("contents.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80), index=True)

    content: Mapped[Content] = relationship(back_populates="tags")


class Folder(Base):
    __tablename__ = "folders"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    cover: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    contents: Mapped[list[Content]] = relationship(secondary=content_folders, back_populates="folders")
    series: Mapped[list[Series]] = relationship(secondary=folder_series, back_populates="folders")


class Series(Base):
    __tablename__ = "series"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    cover: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    contents: Mapped[list[Content]] = relationship(secondary=content_series, back_populates="series")
    folders: Mapped[list[Folder]] = relationship(secondary=folder_series, back_populates="series")


class Draft(Base):
    """Server-side autosave, so an unfinished edit follows you between devices."""

    __tablename__ = "drafts"
    __table_args__ = (UniqueConstraint("owner_id", "key", name="uq_owner_draft_key"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    key: Mapped[str] = mapped_column(String(200), index=True)
    payload: Mapped[str] = mapped_column(Text)
    base_updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    saved_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    content_id: Mapped[str] = mapped_column(ForeignKey("contents.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    body: Mapped[str] = mapped_column(Text)
    hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class SessionToken(Base):
    """Opaque session id stored in an HttpOnly cookie."""

    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    device: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    actor: Mapped[str] = mapped_column(String(60), default="")
    event: Mapped[str] = mapped_column(String(100))
    detail: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
