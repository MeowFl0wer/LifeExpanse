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
    # Primary address: sign-in, recovery and notifications. One address may
    # only ever belong to one account, so recovery is never ambiguous.
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    # Optional second address, used only for recovery. Also unique across the
    # table so it cannot double as somebody else's primary.
    backup_email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    backup_email_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    display_name: Mapped[str] = mapped_column(String(60), default="")
    bio: Mapped[str] = mapped_column(Text, default="")
    # Argon2id via passlib; the plain password is never stored or logged.
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # admin | user. An admin has no content space of its own (需求 3.1).
    role: Mapped[str] = mapped_column(String(16), default="user", index=True)

    # Upload permissions are granted by an admin. Images default on because
    # writing without them feels broken; video is costly enough to be opt-in.
    can_upload_image: Mapped[bool] = mapped_column(Boolean, default=True)
    can_upload_video: Mapped[bool] = mapped_column(Boolean, default=False)

    # TOTP. The secret is encrypted at rest, never returned by any endpoint.
    totp_secret_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
    totp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)

    login_count: Mapped[int] = mapped_column(Integer, default=0)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    contents: Mapped[list[Content]] = relationship(back_populates="author", cascade="all, delete-orphan")

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


class VerificationCode(Base):
    """A short-lived email code for registration, recovery and step-up checks.

    A code is a temporary password, so it is stored hashed exactly like one.
    `attempts` caps guessing; `used_at` makes a code single-use even inside its
    window; `expires_at` keeps that window short.
    """

    __tablename__ = "verification_codes"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    # register | reset_password | change_email | change_password | disable_2fa
    purpose: Mapped[str] = mapped_column(String(32), index=True)
    # Lower-cased address the code was sent to. Not a foreign key: registration
    # issues codes before any user row exists.
    email: Mapped[str] = mapped_column(String(255), index=True)
    code_hash: Mapped[str] = mapped_column(String(255))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class RecoveryCode(Base):
    """Single-use backup code for when the authenticator is unavailable.

    Without these, a lost phone means a permanently locked account that only a
    database edit can rescue.
    """

    __tablename__ = "recovery_codes"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    code_hash: Mapped[str] = mapped_column(String(255))
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class InviteCode(Base):
    """Single-use registration invite, issued from the admin console."""

    __tablename__ = "invite_codes"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    note: Mapped[str] = mapped_column(String(200), default="")
    used_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    @property
    def is_spent(self) -> bool:
        return self.used_at is not None or self.revoked_at is not None


class MediaFile(Base):
    """An uploaded image or video.

    The id is a long random string and forms the URL. That alone is not the
    access control — `visibility` is, and the serving endpoint checks it — but
    it means an unguessable URL is the floor rather than the ceiling.

    The bytes live on disk under a path derived from the id; only the metadata
    is in the database. Keeping them out of SQLite is what lets a backup of the
    database stay small and a media directory be synced separately.
    """

    __tablename__ = "media_files"

    id: Mapped[str] = mapped_column(String(48), primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

    # image | video
    kind: Mapped[str] = mapped_column(String(16), index=True)
    mime: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    # Lets a later version spot duplicates and verify integrity after a restore.
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    original_name: Mapped[str] = mapped_column(String(255), default="")

    # public | private. Private is the default: an upload should not become
    # readable by the world merely because it was uploaded.
    visibility: Mapped[str] = mapped_column(String(16), default="private", index=True)

    # The content this file appears in. Derived from the body on every save
    # rather than declared by the client — see `services.reconcile_media`.
    # Null means nothing references it: either a fresh upload not yet saved
    # into anything, or a file whose content stopped referencing it.
    content_id: Mapped[str | None] = mapped_column(
        ForeignKey("contents.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # When it became unreferenced. The sweep uses this so an accidental delete
    # can be undone within the retention window instead of vanishing at once.
    orphaned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)

    # Whether a thumbnail was generated. Videos and tiny images have none.
    has_thumbnail: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)


class SiteSetting(Base):
    """Single-row key/value store for settings an admin can change at runtime."""

    __tablename__ = "site_settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


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
