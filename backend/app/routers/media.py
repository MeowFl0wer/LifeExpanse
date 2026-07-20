from __future__ import annotations

from datetime import datetime, timezone

from fastapi import (
    APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile, status,
)
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import storage, thumbnails
from ..config import get_settings
from ..db import get_db
from ..models import AuditLog, MediaFile, User
from ..security import current_user, current_user_optional

router = APIRouter(prefix="/api/v1/media", tags=["media"])

"""
Uploads.

Three checks stand between a request and a stored file, in this order:

1. **May this user upload this kind of thing?** `can_upload_image` /
   `can_upload_video`, granted by an admin. An avatar is exempt — a profile
   picture is part of having an account, not a content privilege.
2. **What is it, really?** Decided by inspecting the bytes, never by the
   `Content-Type` header or the filename, both of which the client sets.
3. **Is there room?** Per-user quota, counted from what is actually stored.

Serving mirrors content: public is public, private is the owner's alone, and a
missing file and a forbidden one return the same 404 (ADR-003).
"""

NOT_FOUND = "文件不存在"


def _quota_used(db: Session, user: User) -> int:
    return db.scalar(
        select(func.coalesce(func.sum(MediaFile.size_bytes), 0)).where(
            MediaFile.owner_id == user.id, MediaFile.deleted_at.is_(None)
        )
    ) or 0


def _media_out(media: MediaFile) -> dict:
    return {
        "id": media.id,
        "url": f"/api/v1/media/{media.id}",
        # Empty when there is no thumbnail, so the client falls back to the
        # original rather than requesting a file that does not exist.
        "thumbnail_url": f"/api/v1/media/{media.id}?variant=thumb" if media.has_thumbnail else "",
        "kind": media.kind,
        "mime": media.mime,
        "size_bytes": media.size_bytes,
        "visibility": media.visibility,
        "original_name": media.original_name,
        "has_thumbnail": media.has_thumbnail,
        "thumbnail_state": media.thumbnail_state,
        "content_id": media.content_id,
    }


def _visible_to(media: MediaFile, viewer: User | None) -> bool:
    if media.deleted_at is not None:
        return False
    if media.visibility == "public":
        return True
    return viewer is not None and viewer.id == media.owner_id


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    visibility: str = Query("private", pattern="^(public|private)$"),
    # An avatar is part of having an account, so it is not gated on the
    # admin-granted image permission.
    as_avatar: bool = False,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    settings = get_settings()
    data = await file.read()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "文件是空的")

    sniffed = storage.sniff(data)
    if sniffed is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "只支持 JPEG、PNG、GIF、WebP 图片和 MP4、WebM 视频",
        )

    if sniffed.kind == "image":
        if not as_avatar and not user.can_upload_image:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "你的账号未开通图片上传权限")
        limit = settings.max_image_bytes
    else:
        if as_avatar:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "头像只能是图片")
        if not user.can_upload_video:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "你的账号未开通视频上传权限")
        limit = settings.max_video_bytes

    if len(data) > limit:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"文件不能超过 {limit // 1024 // 1024} MB",
        )

    quota = settings.storage_quota_bytes
    if quota and _quota_used(db, user) + len(data) > quota:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "存储空间不足")

    media_id = storage.new_media_id()
    digest = storage.save(media_id, sniffed.mime, data)

    media = MediaFile(
        id=media_id,
        owner_id=user.id,
        kind=sniffed.kind,
        mime=sniffed.mime,
        size_bytes=len(data),
        sha256=digest,
        # Stored for display only; it is never used to build a path.
        original_name=(file.filename or "")[:255],
        visibility="public" if as_avatar else visibility,
        # Made after the response. Until then display falls back to the
        # original, which is correct just not as cheap.
        has_thumbnail=False,
        thumbnail_state="pending",
    )
    db.add(media)
    db.add(AuditLog(actor=user.username, event="media_uploaded", detail=f"{sniffed.kind} {len(data)}B"))
    db.commit()

    # Decoding a large video takes seconds; making the uploader wait for a
    # picture they have not asked to see yet is the wrong trade. Anything that
    # does not finish is picked up by the startup pass, so a crash here costs
    # a retry rather than a permanently missing thumbnail.
    background.add_task(thumbnails.generate_for, media.id)

    return _media_out(media)


@router.get("/quota")
def quota(user: User = Depends(current_user), db: Session = Depends(get_db)):
    settings = get_settings()
    used = _quota_used(db, user)
    images = db.scalar(
        select(func.count()).select_from(MediaFile).where(
            MediaFile.owner_id == user.id, MediaFile.deleted_at.is_(None),
            MediaFile.kind == "image",
        )
    ) or 0
    videos = db.scalar(
        select(func.count()).select_from(MediaFile).where(
            MediaFile.owner_id == user.id, MediaFile.deleted_at.is_(None),
            MediaFile.kind == "video",
        )
    ) or 0
    return {
        "used_bytes": used,
        "quota_bytes": settings.storage_quota_bytes,
        "images": images,
        "videos": videos,
        "can_upload_image": user.can_upload_image,
        "can_upload_video": user.can_upload_video,
        "max_image_bytes": settings.max_image_bytes,
        "max_video_bytes": settings.max_video_bytes,
    }


@router.get("")
def list_media(
    kind: str = Query("", pattern="^(image|video|)$"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    query = select(MediaFile).where(
        MediaFile.owner_id == user.id, MediaFile.deleted_at.is_(None)
    )
    if kind:
        query = query.where(MediaFile.kind == kind)
    rows = db.scalars(query.order_by(MediaFile.created_at.desc())).all()
    return [{**_media_out(m), "created_at": m.created_at} for m in rows]


@router.get("/{media_id}")
def serve(
    media_id: str,
    variant: str = Query("", pattern="^(thumb|)$"),
    download: bool = False,
    viewer: User | None = Depends(current_user_optional),
    db: Session = Depends(get_db),
):
    media = db.get(MediaFile, media_id)
    # Same 404 for missing, deleted and not-yours — otherwise the response
    # tells a stranger which ids exist (ADR-003).
    if media is None or not _visible_to(media, viewer):
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)

    served_mime = media.mime
    data = None
    if variant == "thumb" and media.has_thumbnail:
        data = storage.load_thumbnail(media.id, media.mime)
        if data is not None:
            served_mime = "image/webp"
    if data is None:
        # Asking for a thumbnail that was never made falls back to the
        # original rather than 404ing: the caller wanted the picture.
        data = storage.load(media.id, media.mime)
    if data is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)

    disposition = "attachment" if download else "inline"
    # The filename is the user's own text, so it is quoted and stripped of
    # anything that could break out of the header.
    safe_name = (media.original_name or f"{media.id}").replace('"', "").replace("\n", "")[:120]

    return Response(
        content=data,
        media_type=served_mime,
        headers={
            # The id is random and the bytes never change, so this is safe to
            # cache hard. Private files are marked so no shared cache keeps them.
            "Cache-Control": (
                "public, max-age=31536000, immutable"
                if media.visibility == "public"
                else "private, max-age=3600"
            ),
            # Belt and braces: even if something slipped past the sniffing, the
            # browser must not be talked into treating it as a document.
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": f'{disposition}; filename="{safe_name}"',
        },
    )


@router.patch("/{media_id}")
def set_visibility(
    media_id: str,
    visibility: str = Query(..., pattern="^(public|private)$"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    media = db.get(MediaFile, media_id)
    if media is None or media.owner_id != user.id or media.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    media.visibility = visibility
    db.commit()
    return {"id": media.id, "visibility": media.visibility}


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(
    media_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    media = db.get(MediaFile, media_id)
    if media is None or media.owner_id != user.id or media.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)

    # Soft delete in the database, hard delete on disk. The row is what frees
    # the quota; keeping the bytes after the user asked for them to go would be
    # the wrong half to preserve.
    media.deleted_at = datetime.now(timezone.utc)
    storage.remove(media.id, media.mime)
    db.add(AuditLog(actor=user.username, event="media_deleted", detail=media.id))
    db.commit()
