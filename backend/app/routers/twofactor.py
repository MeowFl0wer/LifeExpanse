from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import accounts as acc
from .. import email as mailer
from .. import totp as tf
from ..db import get_db
from ..models import AuditLog, User
from ..schemas import (
    RecoveryCodesOut, TotpDisableIn, TotpEnableIn, TotpSetupOut, TotpStatusOut,
)
from ..security import current_user, verify_password

router = APIRouter(prefix="/api/v1/auth/2fa", tags=["2fa"])

"""
Two-factor authentication.

Turning it on is a three-step dance on purpose:

1. `POST /setup` returns a secret to scan. Nothing changes on the account yet.
2. `POST /enable` takes a code from the authenticator. Only a working code
   flips the switch — otherwise a mis-scanned QR would lock the user out of
   their own account the moment they signed out.
3. Recovery codes come back from step 2, shown exactly once.

Turning it *off* is treated as a sensitive action: current password plus a
second proof, same as changing a password.
"""


@router.get("/status", response_model=TotpStatusOut)
def status_(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return TotpStatusOut(
        enabled=user.totp_enabled,
        recovery_codes_left=tf.unused_recovery_count(db, user),
    )


@router.post("/setup", response_model=TotpSetupOut)
def setup(user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.totp_enabled:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "两步验证已经开启")

    # Stored straight away so the code the user is about to type can be checked
    # against it, but `totp_enabled` stays false until they prove it works.
    secret = tf.new_secret()
    tf.store_secret(user, secret)
    db.commit()

    return TotpSetupOut(secret=secret, otpauth_uri=tf.provisioning_uri(user.username, secret))


@router.post("/enable", response_model=RecoveryCodesOut)
def enable(
    payload: TotpEnableIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    secret = tf.secret_for(user)
    if not secret:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "请先扫描二维码")
    if user.totp_enabled:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "两步验证已经开启")

    # The whole point of this step: a wrong code means the authenticator is not
    # really set up, and enabling now would lock the account.
    if not tf.verify_code(secret, payload.code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "验证码不正确，请确认手机时间是否准确")

    user.totp_enabled = True
    db.add(AuditLog(actor=user.username, event="2fa_enabled"))
    db.commit()

    # Shown once. They are hashed on the way in, so nothing can reveal them later.
    codes = tf.generate_recovery_codes(db, user)
    mailer.send_email(
        to=user.email,
        subject="LifeExpanse 已开启两步验证",
        body=(
            "你的账号刚刚开启了两步验证。\n\n"
            "请把恢复码保存在安全的地方——手机丢失时，它们是你唯一的入口。\n"
            "如果这不是你本人的操作，请立即重置密码。"
        ),
    )
    return RecoveryCodesOut(codes=codes)


@router.post("/recovery-codes", response_model=RecoveryCodesOut)
def regenerate_recovery_codes(
    user: User = Depends(current_user), db: Session = Depends(get_db)
):
    """Issues a fresh set, invalidating the old one."""
    if not user.totp_enabled:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "两步验证尚未开启")
    return RecoveryCodesOut(codes=tf.generate_recovery_codes(db, user))


@router.post("/disable")
def disable(
    payload: TotpDisableIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if not user.totp_enabled:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "两步验证尚未开启")

    # An admin without 2FA is the single most valuable target on the site.
    if user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "管理员账号必须保持两步验证开启")

    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "当前密码不正确")

    # Same bar as changing a password: knowing the password is not enough.
    if payload.email_code:
        if not acc.consume_code(db, user.email, "disable_2fa", payload.email_code):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "验证码不正确或已过期")
    elif payload.totp_code:
        if not tf.verify_totp_or_recovery(db, user, payload.totp_code):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "两步验证码不正确")
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "需要邮箱验证码或两步验证码")

    user.totp_enabled = False
    user.totp_secret_enc = None
    # Recovery codes exist to stand in for the authenticator. With 2FA off they
    # would be a second way in to a factor that no longer exists.
    tf.clear_recovery_codes(db, user)
    db.add(AuditLog(actor=user.username, event="2fa_disabled"))
    db.commit()

    mailer.send_email(
        to=user.email,
        subject="LifeExpanse 已关闭两步验证",
        body=(
            "你的账号刚刚关闭了两步验证。\n\n"
            "如果这不是你本人的操作，你的账号可能已被他人控制，请立即重置密码。"
        ),
    )
    return {"detail": "两步验证已关闭"}
