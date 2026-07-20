from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import accounts as acc
from .. import email as mailer
from ..config import get_settings
from ..db import get_db
from ..models import AuditLog, SessionToken, User, utcnow
from ..schemas import (
    ChangeEmailIn, ChangePasswordIn, EmailOnlyIn, LoginIn, MeOut, RegisterIn,
    ProfileIn, RemoveBackupEmailIn, ResetPasswordIn, SetBackupEmailIn, UserOut,
)
from ..security import (
    SESSION_COOKIE, create_session, current_user, hash_password, revoke_session, verify_password,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


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


NEUTRAL_REGISTER = "如果该邮箱可以使用，我们已发送验证码"


@router.post("/register/code")
def request_register_code(payload: EmailOnlyIn, db: Session = Depends(get_db)):
    """Sends a code to a would-be registrant.

    The response is the same whether the address is free, already registered or
    rate limited. An attacker must not be able to use this endpoint to work out
    who has an account here.
    """
    address = acc.normalise_email(payload.email)

    if acc.registration_mode(db) == "closed":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "当前站点未开放注册")

    if acc.email_taken(db, address):
        # Tell the owner, not the requester: if this was not them, they should
        # know somebody is poking at their address.
        mailer.send_email(
            to=address,
            subject="LifeExpanse 注册提醒",
            body=(
                "有人尝试用这个邮箱注册 LifeExpanse，但它已经绑定了一个账号。\n\n"
                "如果是你本人，请直接登录，或使用「忘记密码」找回。\n"
                "如果不是你，可以忽略这封邮件。"
            ),
        )
    else:
        acc.issue_code(db, address, "register")

    return {"detail": NEUTRAL_REGISTER}


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    mode = acc.registration_mode(db)
    if mode == "closed":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "当前站点未开放注册")

    username = payload.username.lower()
    # Usernames are public URLs, so saying one is taken reveals nothing that a
    # visit to /{username} would not. Addresses are the opposite — hence the
    # neutral handling above.
    problem = acc.username_problem(username)
    if problem:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, problem)
    if db.scalar(select(User).where(User.username == username)):
        raise HTTPException(status.HTTP_409_CONFLICT, "该用户名已被占用")

    address = acc.normalise_email(payload.email)
    if mode == "invite":
        if not payload.invite_code or not acc.invite_is_valid(db, payload.invite_code):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "邀请码无效或已被使用")

    # Checked last and reported as a code failure: a caller who guessed an
    # existing address still cannot tell it apart from a wrong code.
    if not acc.consume_code(db, address, "register", payload.code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "验证码不正确或已过期")
    if acc.email_taken(db, address):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "验证码不正确或已过期")

    user = User(
        username=username,
        email=address,
        email_verified=True,
        display_name=payload.display_name or username,
        password_hash=hash_password(payload.password),
        role="user",
    )
    db.add(user)
    db.flush()

    if mode == "invite" and payload.invite_code:
        if not acc.claim_invite(db, payload.invite_code, user):
            # Someone spent it between the check above and here.
            db.rollback()
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "邀请码无效或已被使用")

    db.add(AuditLog(actor=username, event="register"))
    db.commit()
    db.refresh(user)
    return user


# --------------------------------------------------------------------------
# Password reset (forgotten password)
# --------------------------------------------------------------------------

@router.post("/password/forgot")
def forgot_password(payload: EmailOnlyIn, db: Session = Depends(get_db)):
    """Always the same answer, whether or not the address is registered."""
    address = acc.normalise_email(payload.email)
    if acc.find_by_email(db, address) is not None:
        acc.issue_code(db, address, "reset_password")
    return {"detail": acc.NEUTRAL_CODE_SENT}


@router.post("/password/reset")
def reset_password(payload: ResetPasswordIn, db: Session = Depends(get_db)):
    address = acc.normalise_email(payload.email)
    user = acc.find_by_email(db, address)

    # Consume first so a wrong address burns an attempt just like a wrong code,
    # and the two are indistinguishable from outside.
    ok = acc.consume_code(db, address, "reset_password", payload.code)
    if not ok or user is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "验证码不正确或已过期")

    user.password_hash = hash_password(payload.new_password)
    # Any session an attacker may already hold dies with the password.
    for token in db.scalars(
        select(SessionToken).where(SessionToken.user_id == user.id, SessionToken.revoked_at.is_(None))
    ).all():
        token.revoked_at = utcnow()
    db.add(AuditLog(actor=user.username, event="password_reset"))
    db.commit()
    return {"detail": "密码已重置，请重新登录"}


@router.post("/login", response_model=UserOut)
def login(payload: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    credential = payload.credential.strip().lower()
    user = db.scalar(
        select(User).where(
            (func.lower(User.username) == credential)
            | (func.lower(User.email) == credential)
            # A verified backup address signs in too: if the primary inbox is
            # gone, being locked out of the account would be the whole problem
            # a backup address exists to prevent.
            | (
                (func.lower(User.backup_email) == credential)
                & User.backup_email_verified.is_(True)
            )
        )
    )
    # One message for both cases, so it cannot be used to enumerate accounts.
    if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
        db.add(AuditLog(actor=payload.credential[:60], event="login_failed"))
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "用户名或密码不正确")

    # 2FA gate. No session exists yet, so a caller who only has the password
    # gets nothing usable — the "needs 2FA" answer is not itself a login.
    if user.totp_enabled:
        from .. import totp as tf

        if not payload.totp_code:
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED,
                "需要两步验证码",
                headers={"X-Requires-2FA": "1"},
            )
        if not tf.verify_totp_or_recovery(db, user, payload.totp_code):
            db.add(AuditLog(actor=user.username, event="login_2fa_failed"))
            db.commit()
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED,
                "两步验证码不正确",
                headers={"X-Requires-2FA": "1"},
            )

    token = create_session(db, user, request.headers.get("user-agent", ""))
    _set_cookie(response, token, payload.remember)
    # The admin console sorts users by these, so they are recorded here rather
    # than derived from the audit log later.
    user.login_count = (user.login_count or 0) + 1
    user.last_login_at = utcnow()
    db.add(AuditLog(actor=user.username, event="login"))
    db.commit()
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    session_id = request.cookies.get(SESSION_COOKIE)
    if session_id:
        revoke_session(db, session_id)
    response.delete_cookie(SESSION_COOKIE, path="/")


@router.get("/me", response_model=MeOut)
def me(user: User = Depends(current_user)):
    return user


@router.patch("/profile", response_model=MeOut)
def update_profile(
    payload: ProfileIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Changes the display name and bio.

    Not the username. `/{username}` is the address of everything this person
    has published; changing it would break every link anyone ever saved, and
    freeing the old one would let somebody else inherit that audience.
    """
    display_name = payload.display_name.strip()
    if not display_name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "昵称不能为空")

    # Case-insensitive: "Euan" and "euan" reading as different people would
    # defeat the point of the rule.
    clash = db.scalar(
        select(User).where(
            func.lower(User.display_name) == display_name.lower(),
            User.id != user.id,
        )
    )
    if clash is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "该昵称已被使用")

    # A display name that looks like somebody else's username invites
    # impersonation in comments, where both appear as plain text.
    impersonation = db.scalar(
        select(User).where(
            func.lower(User.username) == display_name.lower(), User.id != user.id
        )
    )
    if impersonation is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "该昵称与其他用户的用户名相同")

    user.display_name = display_name
    user.bio = payload.bio.strip()
    db.add(AuditLog(actor=user.username, event="profile_updated"))
    db.commit()
    db.refresh(user)
    return user


# --------------------------------------------------------------------------
# Step-up verification
#
# 需求: changing a password or an email needs the current password *and* a
# second proof. Email is the default second factor; TOTP is the way through
# when the address is no longer reachable. Requiring one of the two — never
# neither — is what stops an unlocked laptop from being enough.
# --------------------------------------------------------------------------

def _verify_step_up(
    db: Session, user: User, email_code: str | None, totp_code: str | None, purpose: str
) -> None:
    if email_code:
        if not acc.consume_code(db, user.email, purpose, email_code):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "验证码不正确或已过期")
        return

    if totp_code:
        from ..totp import verify_totp_or_recovery

        if not verify_totp_or_recovery(db, user, totp_code):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "两步验证码不正确")
        return

    raise HTTPException(
        status.HTTP_400_BAD_REQUEST,
        "需要邮箱验证码或两步验证码",
    )


@router.post("/step-up/code")
def request_step_up_code(
    purpose: str, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    """Sends a code to the signed-in user's own primary address."""
    if purpose not in {"change_password", "change_email", "disable_2fa"}:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "未知的验证用途")
    acc.issue_code(db, user.email, purpose)
    # Neutral even here: rate limiting must not be visible as a distinct state.
    return {"detail": "验证码已发送到你的主邮箱"}


@router.post("/password/change")
def change_password(
    payload: ChangePasswordIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, user.password_hash):
        db.add(AuditLog(actor=user.username, event="password_change_failed"))
        db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "当前密码不正确")

    _verify_step_up(db, user, payload.email_code, payload.totp_code, "change_password")

    user.password_hash = hash_password(payload.new_password)
    db.add(AuditLog(actor=user.username, event="password_changed"))
    db.commit()

    mailer.send_email(
        to=user.email,
        subject="LifeExpanse 密码已修改",
        body=(
            "你的 LifeExpanse 账号密码刚刚被修改。\n\n"
            "如果这不是你本人的操作，请立即通过「忘记密码」重置，并检查登录设备。"
        ),
    )
    return {"detail": "密码已修改"}


@router.post("/email/change/code")
def request_new_email_code(payload: EmailOnlyIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Sends a code to the address the user wants to move to.

    Neutral again: if the address already belongs to somebody, nothing is sent
    but the answer is the same, so this cannot be used to test addresses.
    """
    address = acc.normalise_email(payload.email)
    if not acc.email_taken(db, address, excluding_user_id=user.id):
        acc.issue_code(db, address, "change_email")
    return {"detail": "如果该邮箱可以使用，我们已发送验证码"}


# --------------------------------------------------------------------------
# Backup email
#
# A second address that can recover the account and sign in. That makes it a
# second door, so binding one is guarded exactly like changing the primary.
# --------------------------------------------------------------------------

@router.post("/email/backup/code")
def request_backup_email_code(
    payload: EmailOnlyIn, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    address = acc.normalise_email(payload.email)
    # Neutral: an address already in use gets no code but the same answer, so
    # this cannot be used to test whether someone has an account.
    if not acc.email_taken(db, address, excluding_user_id=user.id):
        acc.issue_code(db, address, "change_email")
    return {"detail": "如果该邮箱可以使用，我们已发送验证码"}


@router.post("/email/backup")
def set_backup_email(
    payload: SetBackupEmailIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "当前密码不正确")

    _verify_step_up(db, user, payload.email_code, payload.totp_code, "change_email")

    address = acc.normalise_email(payload.backup_email)
    if address == acc.normalise_email(user.email):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "备用邮箱不能和主邮箱相同")

    if not acc.consume_code(db, address, "change_email", payload.backup_email_code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "备用邮箱验证码不正确或已过期")
    if acc.email_taken(db, address, excluding_user_id=user.id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "备用邮箱验证码不正确或已过期")

    user.backup_email = address
    user.backup_email_verified = True
    db.add(AuditLog(actor=user.username, event="backup_email_set"))
    db.commit()

    # The primary address is told, for the same reason it is told about a
    # primary change: a new way in should never appear silently.
    mailer.send_email(
        to=user.email,
        subject="LifeExpanse 已绑定备用邮箱",
        body=(
            f"你的账号刚刚绑定了备用邮箱：{acc.mask_email(address)}\n\n"
            "备用邮箱可以用于登录和找回密码。\n"
            "如果这不是你本人的操作，请立即修改密码并解绑该邮箱。"
        ),
    )
    return {"detail": "备用邮箱已绑定"}


@router.delete("/email/backup")
def remove_backup_email(
    payload: RemoveBackupEmailIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if not user.backup_email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "尚未绑定备用邮箱")
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "当前密码不正确")

    _verify_step_up(db, user, payload.email_code, payload.totp_code, "change_email")

    removed = user.backup_email
    user.backup_email = None
    user.backup_email_verified = False
    db.add(AuditLog(actor=user.username, event="backup_email_removed"))
    db.commit()

    mailer.send_email(
        to=user.email,
        subject="LifeExpanse 已解绑备用邮箱",
        body=(
            f"你的账号刚刚解绑了备用邮箱：{acc.mask_email(removed)}\n\n"
            "如果这不是你本人的操作，请立即修改密码。"
        ),
    )
    return {"detail": "备用邮箱已解绑"}


@router.post("/email/change")
def change_email(
    payload: ChangeEmailIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "当前密码不正确")

    # Prove it is really the account holder…
    _verify_step_up(db, user, payload.email_code, payload.totp_code, "change_email")

    new_address = acc.normalise_email(payload.new_email)
    # …and that the new address is reachable and free.
    if not acc.consume_code(db, new_address, "change_email", payload.new_email_code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "新邮箱验证码不正确或已过期")
    if acc.email_taken(db, new_address, excluding_user_id=user.id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "新邮箱验证码不正确或已过期")

    if user.backup_email and acc.normalise_email(user.backup_email) == new_address:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "新邮箱不能和备用邮箱相同")

    old_address = user.email
    user.email = new_address
    user.email_verified = True
    db.add(AuditLog(actor=user.username, event="email_changed"))
    db.commit()

    # The victim's one chance to notice a takeover, so it goes to the address
    # being replaced — and quotes the new one masked.
    mailer.send_email_changed_notice(old_address, acc.mask_email(new_address))
    return {"detail": "邮箱已更新"}


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
