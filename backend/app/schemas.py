from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

# Schemes an excerpt's source link may use.
#
# The frontend refuses anything else at render time, but storing a
# `javascript:` URL and relying on every future consumer to remember is the
# wrong shape: an export, a feed, or a template that forgets would hand it
# straight to a reader. Refusing it at the door means it never exists.
_ALLOWED_URL_SCHEMES = ("https://", "mailto:")


def _validated_source_url(value: str | None) -> str | None:
    if value is None:
        return None
    url = value.strip()
    if not url:
        return None
    # Whitespace and control characters are stripped by browsers when parsing
    # a scheme, so they cannot be allowed to hide one here either.
    compact = "".join(ch for ch in url if not ch.isspace() and ord(ch) > 0x20).lower()
    if not compact.startswith(_ALLOWED_URL_SCHEMES):
        raise ValueError("来源链接只支持 https:// 或 mailto:")
    return url


def _validated_media_url(value: str | None) -> str | None:
    """A cover ends up in an `<img src>`, so the same rule applies.

    Stricter than a link: media loads without anyone clicking, and `data:` in
    the wrong element is a document rather than a picture.
    """
    if value is None:
        return None
    url = value.strip()
    if not url:
        return None
    compact = "".join(ch for ch in url if not ch.isspace() and ord(ch) > 0x20).lower()
    # Our own media paths, or https. A leading `//` is protocol-relative and
    # leaves the site despite the slash.
    if compact.startswith("//"):
        raise ValueError("封面地址不合法")
    if compact.startswith("/") or compact.startswith("https://"):
        return url
    raise ValueError("封面只支持站内媒体或 https:// 地址")


def _validated_tags(tags: list[str]) -> list[str]:
    """Each tag is user text and becomes a row and a URL facet, so it is
    length-bounded like everything else."""
    for tag in tags:
        if len(tag) > 60:
            raise ValueError("单个标签不能超过 60 字符")
    return tags


Visibility = Literal["public", "private", "draft"]
ContentType = Literal["thought", "diary", "pkm"]
ContentKind = Literal["note", "article"]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    username: str
    display_name: str
    bio: str
    role: str
    can_upload_image: bool
    can_upload_video: bool
    totp_enabled: bool


class MeOut(UserOut):
    """The signed-in user's own view: adds what only they may see."""

    email: str
    email_verified: bool
    backup_email: str | None
    backup_email_verified: bool


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)
    # Proves the address is reachable and actually the registrant's.
    code: str = Field(min_length=4, max_length=12)
    display_name: str = ""
    invite_code: str | None = None


class EmailOnlyIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=12)
    new_password: str = Field(min_length=8, max_length=200)


class ChangePasswordIn(BaseModel):
    """需求: changing a password always requires an emailed code as well.

    Knowing the current password is not enough — an unlocked laptop would
    otherwise be all it takes.
    """

    current_password: str
    new_password: str = Field(min_length=8, max_length=200)
    # One of the two must be supplied. Email is the default path; the TOTP code
    # is the way through when the address is no longer reachable.
    email_code: str | None = None
    totp_code: str | None = None


class ChangeEmailIn(BaseModel):
    current_password: str
    new_email: EmailStr
    # Proves the new address is reachable.
    new_email_code: str
    # Proves it is really the account holder asking.
    email_code: str | None = None
    totp_code: str | None = None


class InviteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    code: str
    note: str
    used_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime


class LoginIn(BaseModel):
    credential: str
    password: str
    remember: bool = False
    # Supplied on the second attempt, once the server has said 2FA is needed.
    # Accepts an authenticator code or an unused recovery code.
    totp_code: str | None = None


class TagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str


class ContentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    slug: str
    type: ContentType
    content_kind: ContentKind | None = None
    thought_type: str | None = None
    title: str
    body: str
    summary: str
    visibility: Visibility
    author: str
    tags: list[str] = []
    folder_ids: list[str] = []
    series_ids: list[str] = []
    category: str | None = None
    cover: str | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    allow_comments: bool = False
    favorite: bool = False
    archived: bool = False
    source_author: str | None = None
    source_title: str | None = None
    source_type: str | None = None
    source_url: str | None = None
    source_locator: str | None = None
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None = None


# Length bounds matched to the database columns. Without them, a value longer
# than the column is accepted by the API and then either silently stored
# (SQLite ignores VARCHAR length) or rejected by the database at write time
# (PostgreSQL) — neither is a good way to find out. Text columns have no width,
# so they get a generous ceiling rather than being left unbounded.
_MAX_TITLE = 300
_MAX_BODY = 1_000_000  # ~500 pages; a DoS ceiling, not a content limit
_MAX_SUMMARY = 2_000
_MAX_CATEGORY = 100
_MAX_SEO_TITLE = 300
_MAX_SEO_DESC = 2_000
_MAX_SOURCE_TEXT = 200
_MAX_SOURCE_TYPE = 20
_MAX_THOUGHT_TYPE = 16
_MAX_TAG = 60
_MAX_TAGS = 50


class ContentIn(BaseModel):
    type: ContentType
    title: str = Field(default="", max_length=_MAX_TITLE)
    body: str = Field(max_length=_MAX_BODY)
    summary: str | None = Field(default=None, max_length=_MAX_SUMMARY)
    visibility: Visibility = "private"
    content_kind: ContentKind | None = None
    thought_type: str | None = Field(default=None, max_length=_MAX_THOUGHT_TYPE)
    tags: list[str] = Field(default=[], max_length=_MAX_TAGS)
    folder_ids: list[str] = []
    series_ids: list[str] = []
    category: str | None = Field(default=None, max_length=_MAX_CATEGORY)
    cover: str | None = None
    seo_title: str | None = Field(default=None, max_length=_MAX_SEO_TITLE)
    seo_description: str | None = Field(default=None, max_length=_MAX_SEO_DESC)
    allow_comments: bool | None = None
    favorite: bool | None = None
    archived: bool | None = None
    source_author: str | None = Field(default=None, max_length=_MAX_SOURCE_TEXT)
    source_title: str | None = Field(default=None, max_length=_MAX_SOURCE_TEXT)
    source_type: str | None = Field(default=None, max_length=_MAX_SOURCE_TYPE)
    source_url: str | None = None
    source_locator: str | None = Field(default=None, max_length=_MAX_SOURCE_TEXT)

    @field_validator("tags")
    @classmethod
    def tags_bounded(cls, v: list[str]) -> list[str]:
        return _validated_tags(v)

    @field_validator("source_url")
    @classmethod
    def source_url_scheme(cls, v: str | None) -> str | None:
        return _validated_source_url(v)

    @field_validator("cover")
    @classmethod
    def cover_scheme(cls, v: str | None) -> str | None:
        return _validated_media_url(v)

    @field_validator("body")
    @classmethod
    def body_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("正文不能为空")
        return v


class ContentPatch(BaseModel):
    title: str | None = Field(default=None, max_length=_MAX_TITLE)
    body: str | None = Field(default=None, max_length=_MAX_BODY)
    summary: str | None = Field(default=None, max_length=_MAX_SUMMARY)
    visibility: Visibility | None = None
    content_kind: ContentKind | None = None
    thought_type: str | None = Field(default=None, max_length=_MAX_THOUGHT_TYPE)
    tags: list[str] | None = Field(default=None, max_length=_MAX_TAGS)
    folder_ids: list[str] | None = None
    series_ids: list[str] | None = None
    category: str | None = Field(default=None, max_length=_MAX_CATEGORY)
    cover: str | None = None
    seo_title: str | None = Field(default=None, max_length=_MAX_SEO_TITLE)
    seo_description: str | None = Field(default=None, max_length=_MAX_SEO_DESC)
    allow_comments: bool | None = None
    favorite: bool | None = None
    archived: bool | None = None
    # Excerpt provenance. Absent here previously, which is why a saved excerpt
    # could not have its source corrected — the fields simply had nowhere to go.
    source_author: str | None = Field(default=None, max_length=_MAX_SOURCE_TEXT)
    source_title: str | None = Field(default=None, max_length=_MAX_SOURCE_TEXT)
    source_type: str | None = Field(default=None, max_length=_MAX_SOURCE_TYPE)
    source_url: str | None = None

    @field_validator("tags")
    @classmethod
    def tags_bounded(cls, v: list[str] | None) -> list[str] | None:
        return _validated_tags(v) if v is not None else None
    source_locator: str | None = None

    @field_validator("source_url")
    @classmethod
    def source_url_scheme(cls, v: str | None) -> str | None:
        return _validated_source_url(v)

    @field_validator("cover")
    @classmethod
    def cover_scheme(cls, v: str | None) -> str | None:
        return _validated_media_url(v)


class LibraryIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    cover: str | None = None
    series_ids: list[str] = []

    @field_validator("cover")
    @classmethod
    def cover_scheme(cls, v: str | None) -> str | None:
        return _validated_media_url(v)


class FolderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    description: str
    cover: str | None = None
    owner: str
    series_ids: list[str] = []
    created_at: datetime


class SeriesOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    description: str
    cover: str | None = None
    owner: str
    created_at: datetime


class DraftIn(BaseModel):
    payload: dict[str, Any]
    base_updated_at: datetime | None = None


class DraftOut(BaseModel):
    key: str
    payload: dict[str, Any]
    base_updated_at: datetime | None = None
    saved_at: datetime


class TrashOut(BaseModel):
    item: ContentOut
    deleted_at: datetime
    days_remaining: int


class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class CommentOut(BaseModel):
    id: str
    content_id: str
    author: str
    author_display_name: str
    body: str
    created_at: datetime


class TotpSetupOut(BaseModel):
    """Everything needed to add the account to an authenticator."""

    secret: str
    otpauth_uri: str


class TotpEnableIn(BaseModel):
    # Proves the authenticator is actually set up before it becomes required.
    code: str = Field(min_length=6, max_length=10)


class TotpDisableIn(BaseModel):
    current_password: str
    email_code: str | None = None
    totp_code: str | None = None


class RecoveryCodesOut(BaseModel):
    codes: list[str]


class TotpStatusOut(BaseModel):
    enabled: bool
    recovery_codes_left: int


class SetBackupEmailIn(BaseModel):
    """Binding a second address is a sensitive change: it becomes another way
    into the account, so it needs the same proof as changing the primary."""

    current_password: str
    backup_email: EmailStr
    # Proves the new address is reachable.
    backup_email_code: str
    # Proves it is really the account holder asking.
    email_code: str | None = None
    totp_code: str | None = None


class RemoveBackupEmailIn(BaseModel):
    current_password: str
    email_code: str | None = None
    totp_code: str | None = None


class ProfileIn(BaseModel):
    """What a user may change about themselves.

    The username is absent on purpose: it is the address of their public pages
    and does not change. The display name does, and must stay unique.
    """

    display_name: str = Field(min_length=1, max_length=60)
    bio: str = Field(default="", max_length=500)
