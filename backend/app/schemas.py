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


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=30, pattern=r"^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)
    display_name: str = ""
    invite_code: str | None = None


class LoginIn(BaseModel):
    credential: str
    password: str
    remember: bool = False


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
