from __future__ import annotations

import logging
from dataclasses import dataclass

from .config import get_settings

log = logging.getLogger("lifeexpanse.email")

"""
Outbound email.

Sending is behind one function so the provider can change without any caller
changing. Today that is the console backend, which logs the message; Resend
slots in as another branch of `send_email` when the API key is configured.

Nothing here ever raises into a request handler. If email delivery fails, the
user must still get the same neutral response as a success — otherwise the
error itself reveals whether the address exists.
"""


@dataclass
class SentMessage:
    to: str
    subject: str
    body: str


# Captured only when the console backend is active. Tests read this to assert
# what would have been sent; production uses Resend and never fills it.
outbox: list[SentMessage] = []


def send_email(to: str, subject: str, body: str) -> None:
    settings = get_settings()
    message = SentMessage(to=to, subject=subject, body=body)

    if settings.email_backend == "resend" and settings.resend_api_key:
        _send_via_resend(message)
        return

    outbox.append(message)
    log.info("email to=%s subject=%s\n%s", to, subject, body)


def _send_via_resend(message: SentMessage) -> None:  # pragma: no cover - needs network
    """Placeholder for the Resend integration.

    Deliberately swallows failures: a bounced email must not change what the
    caller returns, or the response becomes an address-existence oracle.
    """
    settings = get_settings()
    try:
        import httpx

        httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.email_from,
                "to": [message.to],
                "subject": message.subject,
                "text": message.body,
            },
            timeout=10,
        )
    except Exception:
        log.exception("failed to send email to %s", message.to)


def send_verification_code(to: str, code: str, purpose: str) -> None:
    what = {
        "register": "完成注册",
        "reset_password": "重置密码",
        "change_email": "更换邮箱",
        "change_password": "修改密码",
        "disable_2fa": "关闭两步验证",
    }.get(purpose, "验证身份")

    settings = get_settings()
    send_email(
        to=to,
        subject=f"LifeExpanse 验证码：{code}",
        body=(
            f"你正在{what}。\n\n"
            f"验证码：{code}\n\n"
            f"{settings.verification_code_ttl_minutes} 分钟内有效，只能使用一次。\n"
            "如果这不是你本人的操作，请忽略这封邮件，并考虑更换密码。"
        ),
    )


def send_email_changed_notice(to: str, new_email_masked: str) -> None:
    """Warns the *old* address that the account's email was changed.

    This is the one signal a victim gets when an attacker takes over an
    account, so it goes to the address being replaced, not the new one.
    """
    send_email(
        to=to,
        subject="LifeExpanse 账号邮箱已变更",
        body=(
            "你的 LifeExpanse 账号邮箱刚刚被修改为："
            f"{new_email_masked}\n\n"
            "如果这是你本人的操作，可以忽略这封邮件。\n"
            "如果不是，你的账号可能已被他人控制，请立即通过备用邮箱或恢复码找回账号。"
        ),
    )
