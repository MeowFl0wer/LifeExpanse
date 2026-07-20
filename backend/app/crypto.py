from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets

from .config import get_settings

"""
Encryption for secrets held at rest.

Scope, stated plainly so nobody mistakes this for more than it is:

* This protects a **stolen database file or backup**. The key lives in the
  server's environment, so it does *not* protect against an attacker who has
  the running server — they can read the key and decrypt.
* It is used for values that must be recoverable in plain form (a TOTP secret
  has to be compared against the authenticator). Anything that only needs
  checking, never reading — passwords, verification codes, recovery codes —
  is **hashed** instead, which is strictly stronger.
* Content bodies are deliberately *not* encrypted here. Keyword search runs in
  SQL over the body, and column-level encryption would break it while adding
  little against a live-server compromise. Content at rest is covered by disk
  or volume encryption at deploy time; genuine end-to-end secrecy is what the
  加密空间 feature is for.

The construction is AES-256-GCM when `cryptography` is available. It is not a
home-made cipher: GCM gives both secrecy and tamper detection, and a fresh
random nonce per message is what keeps it safe.
"""

try:  # pragma: no cover - exercised by whichever branch the environment has
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    _HAVE_AESGCM = True
except ImportError:  # pragma: no cover
    _HAVE_AESGCM = False

_NONCE_BYTES = 12
_PREFIX = "v1:"


def _key() -> bytes:
    """Derives a 32-byte key from the configured secret.

    HKDF-style domain separation keeps this key distinct from anything else
    derived from the same secret, so reusing `secret_key` elsewhere later
    cannot weaken this.
    """
    settings = get_settings()
    return hashlib.blake2b(
        settings.secret_key.encode("utf-8"),
        digest_size=32,
        person=b"life-at-rest-v1",
    ).digest()


def encrypt(plaintext: str) -> str:
    """Encrypts a secret for storage. Returns an opaque, ASCII-safe string."""
    if not plaintext:
        return ""
    if not _HAVE_AESGCM:  # pragma: no cover
        raise RuntimeError(
            "cryptography is required to store secrets at rest; "
            "install it or disable the features that need it"
        )
    nonce = os.urandom(_NONCE_BYTES)
    blob = AESGCM(_key()).encrypt(nonce, plaintext.encode("utf-8"), None)
    return _PREFIX + base64.urlsafe_b64encode(nonce + blob).decode("ascii")


def decrypt(stored: str) -> str:
    """Reverses `encrypt`. Raises ValueError if the value was tampered with."""
    if not stored:
        return ""
    if not stored.startswith(_PREFIX):
        raise ValueError("unrecognised ciphertext format")
    if not _HAVE_AESGCM:  # pragma: no cover
        raise RuntimeError("cryptography is required to read secrets at rest")

    raw = base64.urlsafe_b64decode(stored[len(_PREFIX):].encode("ascii"))
    nonce, blob = raw[:_NONCE_BYTES], raw[_NONCE_BYTES:]
    return AESGCM(_key()).decrypt(nonce, blob, None).decode("utf-8")


def hash_secret(value: str) -> str:
    """Hashes a short-lived secret (verification or recovery code).

    These are high-entropy and checked constantly, so a fast keyed hash is the
    right tool — Argon2 here would only add latency to every attempt. The key
    means a stolen database alone cannot be brute-forced offline.
    """
    return hmac.new(_key(), value.strip().encode("utf-8"), hashlib.sha256).hexdigest()


def verify_secret(value: str, hashed: str) -> bool:
    """Constant-time comparison, so a timing signal cannot leak the code."""
    return hmac.compare_digest(hash_secret(value), hashed)


def generate_numeric_code(digits: int = 6) -> str:
    """A numeric email code. `secrets` matters here: a predictable code is no code."""
    upper = 10 ** digits
    return str(secrets.randbelow(upper)).zfill(digits)


def generate_recovery_code() -> str:
    """Ten crockford-ish characters, grouped for reading off a printout."""
    alphabet = "ABCDEFGHJKMNPQRSTVWXYZ23456789"  # no I/L/O/0/1/U
    raw = "".join(secrets.choice(alphabet) for _ in range(10))
    return f"{raw[:5]}-{raw[5:]}"


def generate_invite_code() -> str:
    return secrets.token_urlsafe(12)
