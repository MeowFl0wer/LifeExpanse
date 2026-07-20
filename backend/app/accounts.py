from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import email as mailer
from .config import get_settings
from .crypto import (
    generate_invite_code, generate_numeric_code, hash_secret, verify_secret,
)
from .models import InviteCode, SiteSetting, User, VerificationCode, utcnow

"""
Account rules: registration, email verification and step-up checks.

Two principles run through the whole file:

1. **Never confirm whether an address or username exists.** Every path that a
   stranger can reach returns the same thing whether or not the account is
   there. This is the same rule as the identical 404 on content (ADR-003).
2. **A verification code is a temporary password.** It is stored hashed, it
   expires quickly, it is single-use, it caps guesses, and requesting them is
   rate limited.
"""

# 需求 §259: usernames that would collide with a platform route. A user who
# grabbed one of these would shadow a real page at /{username}.
RESERVED_USERNAMES = {
    "about", "account", "admin", "api", "app", "assets", "auth", "blog",
    "dashboard", "diary", "docs", "explore", "export", "feed", "flights",
    "help", "home", "import", "login", "logout", "map", "me", "media", "new",
    "notifications", "pkm", "privacy", "public", "register", "reset", "root",
    "rss", "search", "series", "settings", "signin", "signout", "signup",
    "site", "space", "static", "status", "support", "system", "tag", "tags",
    "terms", "thoughts", "trajectory", "trash", "upload", "user", "users",
    "verify", "www",
}

USERNAME_PATTERN = re.compile(r"^[a-zA-Z][a-zA-Z0-9_-]{2,29}$")

# Deliberately identical for "sent" and "not sent" — see principle 1.
NEUTRAL_CODE_SENT = "如果该邮箱存在，我们已发送验证码"

REGISTRATION_MODES = {"closed", "invite", "open"}


# --------------------------------------------------------------------------
# Site settings
# --------------------------------------------------------------------------

def get_setting(db: Session, key: str, default: str = "") -> str:
    row = db.get(SiteSetting, key)
    return row.value if row else default


def set_setting(db: Session, key: str, value: str) -> None:
    row = db.get(SiteSetting, key)
    if row is None:
        db.add(SiteSetting(key=key, value=value))
    else:
        row.value = value
    db.commit()


def registration_mode(db: Session) -> str:
    """Stored mode wins over the config default, so an admin can change it live."""
    stored = get_setting(db, "registration_mode")
    if stored in REGISTRATION_MODES:
        return stored
    return get_settings().registration_mode


# --------------------------------------------------------------------------
# Names and addresses
# --------------------------------------------------------------------------

def normalise_email(value: str) -> str:
    return value.strip().lower()


def username_problem(username: str) -> str | None:
    """Returns why a username is unacceptable, or None if it is fine."""
    if not USERNAME_PATTERN.match(username):
        return "用户名需以字母开头，3–30 位，只能包含字母、数字、下划线和连字符"
    if username.lower() in RESERVED_USERNAMES:
        return "该用户名已被系统保留，请换一个"
    return None


def mask_email(address: str) -> str:
    """Mirrors the frontend `maskEmail`: fixed-width mask, domain kept.

    Used in notification emails, where quoting the new address in full would
    hand it to whoever is reading the old inbox.
    """
    trimmed = address.strip()
    if not trimmed:
        return ""
    at = trimmed.rfind("@")
    if at < 0:
        return _mask_local(trimmed)
    if at == 0:
        return "***"
    return f"{_mask_local(trimmed[:at])}@{trimmed[at + 1:]}"


def _mask_local(local: str) -> str:
    if len(local) == 1:
        return "*"
    if len(local) == 2:
        return f"{local[0]}*"
    return f"{local[0]}***{local[-1]}"


def find_by_email(db: Session, address: str) -> User | None:
    """Looks up an account by either of its addresses."""
    address = normalise_email(address)
    if not address:
        return None
    return db.scalars(
        select(User).where(
            (func.lower(User.email) == address) | (func.lower(User.backup_email) == address)
        )
    ).first()


def email_taken(db: Session, address: str, *, excluding_user_id: str | None = None) -> bool:
    """An address may only ever belong to one account, primary or backup."""
    existing = find_by_email(db, address)
    if existing is None:
        return False
    return existing.id != excluding_user_id


# --------------------------------------------------------------------------
# Verification codes
# --------------------------------------------------------------------------

def _window_start() -> datetime:
    settings = get_settings()
    return datetime.now(timezone.utc) - timedelta(
        minutes=settings.verification_rate_window_minutes
    )


def rate_limited(db: Session, address: str, purpose: str) -> bool:
    settings = get_settings()
    recent = db.scalar(
        select(func.count())
        .select_from(VerificationCode)
        .where(
            VerificationCode.email == normalise_email(address),
            VerificationCode.purpose == purpose,
            VerificationCode.created_at >= _window_start(),
        )
    )
    return (recent or 0) >= settings.verification_rate_limit


def issue_code(db: Session, address: str, purpose: str) -> str | None:
    """Creates and emails a code. Returns None when rate limited.

    Callers must respond identically either way — a different response for the
    limited case would let someone probe how often an address is being used.
    """
    address = normalise_email(address)
    if rate_limited(db, address, purpose):
        return None

    settings = get_settings()
    code = generate_numeric_code()
    db.add(
        VerificationCode(
            purpose=purpose,
            email=address,
            code_hash=hash_secret(code),
            expires_at=datetime.now(timezone.utc)
            + timedelta(minutes=settings.verification_code_ttl_minutes),
        )
    )
    db.commit()
    mailer.send_verification_code(address, code, purpose)
    return code


def consume_code(db: Session, address: str, purpose: str, code: str) -> bool:
    """Checks and burns a code. False for wrong, expired, spent or over-tried.

    The newest unused code for the address wins, so requesting a second code
    does not leave the first one usable.
    """
    address = normalise_email(address)
    settings = get_settings()
    now = datetime.now(timezone.utc)

    row = db.scalars(
        select(VerificationCode)
        .where(
            VerificationCode.email == address,
            VerificationCode.purpose == purpose,
            VerificationCode.used_at.is_(None),
        )
        .order_by(VerificationCode.created_at.desc())
    ).first()

    if row is None:
        return False
    if _aware(row.expires_at) < now:
        return False
    if row.attempts >= settings.verification_max_attempts:
        return False

    if not verify_secret(code, row.code_hash):
        # Count the miss so guessing runs out, and keep the code alive only
        # while attempts remain.
        row.attempts += 1
        db.commit()
        return False

    row.used_at = now
    db.commit()
    return True


def _aware(value: datetime) -> datetime:
    """SQLite hands back naive datetimes; compare them as UTC."""
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


# --------------------------------------------------------------------------
# Invite codes
# --------------------------------------------------------------------------

def create_invite(db: Session, admin: User, note: str = "") -> InviteCode:
    invite = InviteCode(code=generate_invite_code(), created_by=admin.id, note=note[:200])
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return invite


def claim_invite(db: Session, code: str, user: User) -> bool:
    """Marks an invite as spent. False if it is unknown, used or revoked."""
    invite = db.scalars(select(InviteCode).where(InviteCode.code == code.strip())).first()
    if invite is None or invite.is_spent:
        return False
    invite.used_by = user.id
    invite.used_at = utcnow()
    db.commit()
    return True


def invite_is_valid(db: Session, code: str) -> bool:
    invite = db.scalars(select(InviteCode).where(InviteCode.code == code.strip())).first()
    return invite is not None and not invite.is_spent
