from __future__ import annotations

import os
import platform
import time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import accounts as acc
from ..db import get_db
from ..models import AuditLog, Content, InviteCode, SessionToken, User
from ..security import current_user

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

"""
The administration console.

Scope is deliberately narrow: this manages **accounts and site settings**. It
does not read anyone's content. The one place it comes close is the per-user
storage summary, which counts rows and bytes without touching titles or bodies
— enough to see who is filling the disk, not enough to read their diary.

Every route here goes through `require_admin`, and the admin role is the only
thing that opens it. The site owner's own account (`euan`) is a normal user.
"""

# Set when the module is first imported, i.e. at process start.
_STARTED_AT = time.time()


def require_admin(user: User = Depends(current_user)) -> User:
    if not user.is_admin:
        # Same shape as any other missing route: an ordinary user should not
        # learn that an admin console exists here.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "页面不存在")
    return user


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


# --------------------------------------------------------------------------
# System status
# --------------------------------------------------------------------------

@router.get("/status")
def system_status(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)

    # "Online" means holding a live session that saw use recently. A session
    # that merely has not expired is not the same as somebody being here.
    active_window = now - timedelta(minutes=15)
    online = db.scalar(
        select(func.count(func.distinct(SessionToken.user_id))).where(
            SessionToken.revoked_at.is_(None),
            SessionToken.expires_at > now,
            SessionToken.created_at > active_window,
        )
    )

    live_sessions = db.scalar(
        select(func.count()).select_from(SessionToken).where(
            SessionToken.revoked_at.is_(None), SessionToken.expires_at > now
        )
    )

    try:
        load1, load5, load15 = os.getloadavg()
    except (OSError, AttributeError):  # pragma: no cover - platform dependent
        load1 = load5 = load15 = 0.0

    return {
        "uptime_seconds": int(time.time() - _STARTED_AT),
        "load_average": [round(load1, 2), round(load5, 2), round(load15, 2)],
        "cpu_count": os.cpu_count() or 0,
        "platform": platform.platform(),
        "python_version": platform.python_version(),
        "online_users": online or 0,
        "live_sessions": live_sessions or 0,
        "total_users": db.scalar(select(func.count()).select_from(User).where(User.role == "user")) or 0,
        "total_contents": db.scalar(
            select(func.count()).select_from(Content).where(Content.deleted_at.is_(None))
        ) or 0,
        "registration_mode": acc.registration_mode(db),
        "server_time": now,
    }


# --------------------------------------------------------------------------
# Users
# --------------------------------------------------------------------------

SORTS = {
    "login_count": User.login_count.desc(),
    "last_login": User.last_login_at.desc(),
    "created": User.created_at.desc(),
}


@router.get("/users")
def list_users(
    sort: str = Query("created", pattern="^(login_count|last_login|created)$"),
    keyword: str = "",
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = select(User).where(User.role == "user")
    if keyword.strip():
        needle = f"%{keyword.strip().lower()}%"
        query = query.where(
            func.lower(User.username).like(needle) | func.lower(User.display_name).like(needle)
        )

    rows = db.scalars(query.order_by(SORTS[sort])).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "display_name": u.display_name,
            # Masked even here: the console manages accounts, and a full
            # address on a list screen is more exposure than the job needs.
            "email_masked": acc.mask_email(u.email),
            "is_active": u.is_active,
            "totp_enabled": u.totp_enabled,
            "can_upload_image": u.can_upload_image,
            "can_upload_video": u.can_upload_video,
            "login_count": u.login_count,
            "last_login_at": _aware(u.last_login_at),
            "created_at": _aware(u.created_at),
        }
        for u in rows
    ]


@router.get("/users/{user_id}")
def user_detail(
    user_id: str, _: User = Depends(require_admin), db: Session = Depends(get_db)
):
    target = db.get(User, user_id)
    if target is None or target.is_admin:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "用户不存在")

    live = select(Content).where(Content.author_id == target.id, Content.deleted_at.is_(None))

    def count_where(*conditions):
        return db.scalar(
            select(func.count()).select_from(Content).where(
                Content.author_id == target.id, Content.deleted_at.is_(None), *conditions
            )
        ) or 0

    return {
        "id": target.id,
        "username": target.username,
        "display_name": target.display_name,
        "email_masked": acc.mask_email(target.email),
        "backup_email_masked": acc.mask_email(target.backup_email or ""),
        "email_verified": target.email_verified,
        "is_active": target.is_active,
        "totp_enabled": target.totp_enabled,
        "can_upload_image": target.can_upload_image,
        "can_upload_video": target.can_upload_video,
        "login_count": target.login_count,
        "last_login_at": _aware(target.last_login_at),
        "created_at": _aware(target.created_at),
        # Counts only. No titles, no bodies — the console is not a reader.
        "content_counts": {
            "total": db.scalar(select(func.count()).select_from(live.subquery())) or 0,
            "thought": count_where(Content.type == "thought"),
            "diary": count_where(Content.type == "diary"),
            "pkm": count_where(Content.type == "pkm"),
            "public": count_where(Content.visibility == "public"),
        },
        # Uploads are not implemented yet; the shape is here so the console
        # does not need reworking when they arrive.
        "media_counts": {"images": 0, "videos": 0, "bytes": 0},
    }


@router.patch("/users/{user_id}/permissions")
def set_permissions(
    user_id: str,
    can_upload_image: bool | None = None,
    can_upload_video: bool | None = None,
    is_active: bool | None = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    target = db.get(User, user_id)
    if target is None or target.is_admin:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "用户不存在")

    changes = []
    if can_upload_image is not None and can_upload_image != target.can_upload_image:
        target.can_upload_image = can_upload_image
        changes.append(f"can_upload_image={can_upload_image}")
    if can_upload_video is not None and can_upload_video != target.can_upload_video:
        target.can_upload_video = can_upload_video
        changes.append(f"can_upload_video={can_upload_video}")
    if is_active is not None and is_active != target.is_active:
        target.is_active = is_active
        changes.append(f"is_active={is_active}")

    if changes:
        # Granting rights to someone else is exactly the kind of act that must
        # leave a trace naming who did it.
        db.add(AuditLog(
            actor=admin.username,
            event="permissions_changed",
            detail=f"{target.username}: {', '.join(changes)}",
        ))
    db.commit()
    db.refresh(target)
    return {
        "can_upload_image": target.can_upload_image,
        "can_upload_video": target.can_upload_video,
        "is_active": target.is_active,
    }


# --------------------------------------------------------------------------
# Site settings
# --------------------------------------------------------------------------

@router.get("/settings")
def get_site_settings(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return {"registration_mode": acc.registration_mode(db)}


@router.patch("/settings/registration-mode")
def set_registration_mode(
    mode: str = Query(..., pattern="^(closed|invite|open)$"),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    previous = acc.registration_mode(db)
    acc.set_setting(db, "registration_mode", mode)
    db.add(AuditLog(
        actor=admin.username,
        event="registration_mode_changed",
        detail=f"{previous} → {mode}",
    ))
    db.commit()
    return {"registration_mode": mode}


# --------------------------------------------------------------------------
# Invite codes
# --------------------------------------------------------------------------

@router.get("/invites")
def list_invites(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.scalars(select(InviteCode).order_by(InviteCode.created_at.desc())).all()
    out = []
    for row in rows:
        used_by = db.get(User, row.used_by) if row.used_by else None
        out.append({
            "id": row.id,
            "code": row.code,
            "note": row.note,
            "used_by": used_by.username if used_by else None,
            "used_at": _aware(row.used_at),
            "revoked_at": _aware(row.revoked_at),
            "created_at": _aware(row.created_at),
            "spent": row.is_spent,
        })
    return out


@router.post("/invites", status_code=status.HTTP_201_CREATED)
def create_invite(
    note: str = "", admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    invite = acc.create_invite(db, admin, note)
    db.add(AuditLog(actor=admin.username, event="invite_created", detail=invite.code))
    db.commit()
    return {"id": invite.id, "code": invite.code, "note": invite.note}


@router.delete("/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_invite(
    invite_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    invite = db.get(InviteCode, invite_id)
    if invite is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "邀请码不存在")
    if invite.used_at is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "该邀请码已被使用，无法撤销")
    invite.revoked_at = datetime.now(timezone.utc)
    db.add(AuditLog(actor=admin.username, event="invite_revoked", detail=invite.code))
    db.commit()


# --------------------------------------------------------------------------
# Audit log
# --------------------------------------------------------------------------

@router.get("/audit")
def audit_log(
    limit: int = Query(100, ge=1, le=500),
    event: str = "",
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = select(AuditLog).order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
    if event.strip():
        query = query.where(AuditLog.event == event.strip())
    rows = db.scalars(query.limit(limit)).all()
    return [
        {
            "id": r.id,
            "actor": r.actor,
            "event": r.event,
            "detail": r.detail,
            "created_at": _aware(r.created_at),
        }
        for r in rows
    ]
