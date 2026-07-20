from __future__ import annotations

import logging
import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .models import User
from .security import hash_password

log = logging.getLogger("lifeexpanse.bootstrap")

"""
First-run setup for the administrative account.

The admin (需求 3.1) owns no content: it manages accounts and site settings and
nothing else. Keeping it separate from the site owner's own account means a
compromised admin login does not also hand over the diary.
"""


def ensure_admin(db: Session) -> User | None:
    """Creates the admin account if it does not exist yet.

    If no bootstrap password is configured, a strong one is generated and
    logged **once**. An unconfigured deployment must never end up with a
    guessable admin — that is worse than an operator having to read the log.
    """
    settings = get_settings()
    username = settings.admin_username

    existing = db.scalar(select(User).where(User.username == username))
    if existing is not None:
        # Repair the role in case the row predates the role column.
        if existing.role != "admin":
            existing.role = "admin"
            db.commit()
        return existing

    password = settings.admin_bootstrap_password
    generated = False
    if not password:
        password = secrets.token_urlsafe(18)
        generated = True

    admin = User(
        username=username,
        email=f"{username.lower()}@localhost",
        email_verified=False,
        display_name=username,
        password_hash=hash_password(password),
        role="admin",
        # An admin has no content space, so content permissions are meaningless.
        can_upload_image=False,
        can_upload_video=False,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    if generated:
        log.warning(
            "Created admin account %s with a generated password: %s\n"
            "Sign in, change it, and set up two-factor authentication now. "
            "This password is not stored anywhere and will not be shown again.",
            username,
            password,
        )
    else:
        log.info("Created admin account %s from LIFE_ADMIN_BOOTSTRAP_PASSWORD", username)

    return admin
