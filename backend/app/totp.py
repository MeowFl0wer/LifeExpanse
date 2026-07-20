from __future__ import annotations

import pyotp
from sqlalchemy import select
from sqlalchemy.orm import Session

from .crypto import decrypt, encrypt, generate_recovery_code, hash_secret, verify_secret
from .models import RecoveryCode, User, utcnow

"""
Two-factor authentication with a standard TOTP authenticator.

The secret is stored encrypted rather than hashed, because verifying a TOTP
code requires the secret itself. Recovery codes are the opposite — only ever
compared — so they are hashed.

Recovery codes are not optional. Without them a lost phone locks the account
permanently, and the only repair is editing the database by hand.
"""

RECOVERY_CODE_COUNT = 10
ISSUER = "LifeExpanse"


def new_secret() -> str:
    return pyotp.random_base32()


def provisioning_uri(username: str, secret: str) -> str:
    """The `otpauth://` URI an authenticator app scans."""
    return pyotp.TOTP(secret).provisioning_uri(name=username, issuer_name=ISSUER)


def verify_code(secret: str, code: str) -> bool:
    """Checks a 6-digit code.

    `valid_window=1` accepts the neighbouring 30-second steps, which covers
    ordinary clock drift between the phone and the server. Wider than that
    starts to meaningfully extend the guessing window.
    """
    if not secret or not code:
        return False
    return pyotp.TOTP(secret).verify(code.strip().replace(" ", ""), valid_window=1)


def secret_for(user: User) -> str:
    return decrypt(user.totp_secret_enc) if user.totp_secret_enc else ""


def store_secret(user: User, secret: str) -> None:
    user.totp_secret_enc = encrypt(secret)


def clear_recovery_codes(db: Session, user: User) -> None:
    """Removes every recovery code. Used when 2FA is switched off — leaving
    them behind would keep a second way in for a factor that no longer exists."""
    for row in db.scalars(select(RecoveryCode).where(RecoveryCode.user_id == user.id)).all():
        db.delete(row)
    db.commit()


def generate_recovery_codes(db: Session, user: User) -> list[str]:
    """Issues a fresh set, replacing any that already exist.

    Returned in plain exactly once — they are hashed on the way in, so nothing
    can show them again later. That is the point.
    """
    for row in db.scalars(select(RecoveryCode).where(RecoveryCode.user_id == user.id)).all():
        db.delete(row)

    codes = [generate_recovery_code() for _ in range(RECOVERY_CODE_COUNT)]
    for code in codes:
        db.add(RecoveryCode(user_id=user.id, code_hash=hash_secret(code)))
    db.commit()
    return codes


def consume_recovery_code(db: Session, user: User, code: str) -> bool:
    """Spends one recovery code. Each works exactly once."""
    candidate = code.strip().upper()
    if not candidate:
        return False

    for row in db.scalars(
        select(RecoveryCode).where(
            RecoveryCode.user_id == user.id, RecoveryCode.used_at.is_(None)
        )
    ).all():
        if verify_secret(candidate, row.code_hash):
            row.used_at = utcnow()
            db.commit()
            return True
    return False


def unused_recovery_count(db: Session, user: User) -> int:
    rows = db.scalars(
        select(RecoveryCode).where(
            RecoveryCode.user_id == user.id, RecoveryCode.used_at.is_(None)
        )
    ).all()
    return len(rows)


def verify_totp_or_recovery(db: Session, user: User, code: str) -> bool:
    """Accepts either a live authenticator code or an unused recovery code.

    Used wherever 2FA stands in for an email code, so a user whose address is
    unreachable still has a way through.
    """
    if not user.totp_enabled:
        return False
    if verify_code(secret_for(user), code):
        return True
    return consume_recovery_code(db, user, code)
