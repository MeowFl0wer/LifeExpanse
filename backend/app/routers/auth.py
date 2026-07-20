from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import AuditLog, SessionToken, User
from ..schemas import LoginIn, RegisterIn, UserOut
from ..security import (
    SESSION_COOKIE, create_session, current_user, hash_password, revoke_session, verify_password,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

RESERVED = {
    "login", "logout", "register", "signup", "app", "dashboard", "admin", "api",
    "settings", "account", "assets", "static", "uploads", "health", "search",
    "about", "terms", "privacy", "new", "trash",
}


def _set_cookie(response: Response, token: SessionToken, remember: bool) -> None:
    settings = get_settings()
    response.set_cookie(
        SESSION_COOKIE,
        token.id,
        httponly=True,
        samesite="lax",
        secure=False,  # set True behind HTTPS in production
        # Without max_age the cookie dies with the browser session, which is
        # what an unticked "keep me signed in" should do.
        max_age=settings.session_days * 24 * 3600 if remember else None,
        path="/",
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    settings = get_settings()
    if settings.registration_mode == "closed":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "当前站点未开放注册")
    if settings.registration_mode == "invite" and not payload.invite_code:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "需要邀请码")

    username = payload.username.lower()
    if username in RESERVED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "该用户名为系统保留字")
    if db.scalar(select(User).where(User.username == username)):
        raise HTTPException(status.HTTP_409_CONFLICT, "该用户名已被占用")
    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "该邮箱已被使用")

    user = User(
        username=username,
        email=payload.email,
        display_name=payload.display_name or username,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.add(AuditLog(actor=username, event="register"))
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=UserOut)
def login(payload: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(
        select(User).where(
            (User.username == payload.credential.lower()) | (User.email == payload.credential)
        )
    )
    # One message for both cases, so it cannot be used to enumerate accounts.
    if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
        db.add(AuditLog(actor=payload.credential[:60], event="login_failed"))
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "用户名或密码不正确")

    token = create_session(db, user, request.headers.get("user-agent", ""))
    _set_cookie(response, token, payload.remember)
    db.add(AuditLog(actor=user.username, event="login"))
    db.commit()
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    session_id = request.cookies.get(SESSION_COOKIE)
    if session_id:
        revoke_session(db, session_id)
    response.delete_cookie(SESSION_COOKIE, path="/")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


@router.get("/sessions")
def sessions(request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    current = request.cookies.get(SESSION_COOKIE)
    rows = db.scalars(
        select(SessionToken).where(SessionToken.user_id == user.id, SessionToken.revoked_at.is_(None))
    ).all()
    return [
        {
            "id": s.id[:8],
            "device": s.device,
            "created_at": s.created_at,
            "expires_at": s.expires_at,
            "current": s.id == current,
        }
        for s in rows
    ]
