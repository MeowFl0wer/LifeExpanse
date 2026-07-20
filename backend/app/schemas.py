from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

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


class ContentIn(BaseModel):
    type: ContentType
    title: str = ""
    body: str
    summary: str | None = None
    visibility: Visibility = "private"
    content_kind: ContentKind | None = None
    thought_type: str | None = None
    tags: list[str] = []
    folder_ids: list[str] = []
    series_ids: list[str] = []
    category: str | None = None
    cover: str | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    allow_comments: bool | None = None
    favorite: bool | None = None
    archived: bool | None = None
    source_author: str | None = None
    source_title: str | None = None
    source_type: str | None = None
    source_url: str | None = None
    source_locator: str | None = None

    @field_validator("body")
    @classmethod
    def body_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("正文不能为空")
        return v


class ContentPatch(BaseModel):
    title: str | None = None
    body: str | None = None
    summary: str | None = None
    visibility: Visibility | None = None
    content_kind: ContentKind | None = None
    thought_type: str | None = None
    tags: list[str] | None = None
    folder_ids: list[str] | None = None
    series_ids: list[str] | None = None
    category: str | None = None
    cover: str | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    allow_comments: bool | None = None
    favorite: bool | None = None
    archived: bool | None = None


class LibraryIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    cover: str | None = None
    series_ids: list[str] = []


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
