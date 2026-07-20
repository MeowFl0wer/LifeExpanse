from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request, status
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import SessionToken, User

# Argon2id, as the spec requires. Passwords are never stored or logged in plain.
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

SESSION_COOKIE = "life_session"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(password, hashed)
    except ValueError:
        return False


def create_session(db: Session, user: User, device: str = "") -> SessionToken:
    settings = get_settings()
    token = SessionToken(
        id=secrets.token_urlsafe(32),
        user_id=user.id,
        device=device[:200],
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.session_days),
    )
    db.add(token)
    db.commit()
    return token


def revoke_session(db: Session, session_id: str) -> None:
    token = db.get(SessionToken, session_id)
    if token and token.revoked_at is None:
        token.revoked_at = datetime.now(timezone.utc)
        db.commit()


def _session_user(db: Session, session_id: str | None) -> User | None:
    if not session_id:
        return None
    token = db.get(SessionToken, session_id)
    if token is None or token.revoked_at is not None:
        return None
    if token.expires_at.replace(tzinfo=timezone.utc) <= datetime.now(timezone.utc):
        return None
    user = db.get(User, token.user_id)
    if user is None or not user.is_active:
        return None
    return user


def current_user_optional(request: Request, db: Session = Depends(get_db)) -> User | None:
    """The signed-in user, or None. Used by endpoints that guests may call."""
    return _session_user(db, request.cookies.get(SESSION_COOKIE))


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Requires a signed-in user."""
    user = _session_user(db, request.cookies.get(SESSION_COOKIE))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="需要登录")
    return user


def require_site_owner(user: User = Depends(current_user)) -> User:
    if user.username != get_settings().site_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有权限")
    return user
