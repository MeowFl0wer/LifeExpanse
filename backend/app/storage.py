from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from pathlib import Path

from .config import get_settings

"""
Where uploaded bytes live.

Everything that touches the filesystem is behind this module, so swapping to
object storage later means rewriting one file rather than hunting through
routers. The database only ever holds metadata.

Two rules that matter more than they look:

* **The stored filename comes from us, never from the client.** A name like
  `../../app/main.py` is a real upload; deriving the path from our own random
  id makes that class of attack impossible rather than filtered.
* **The type is decided by inspecting the bytes**, not by the `Content-Type`
  header or the extension, both of which the client controls.
"""

# Magic numbers, in the order they must be checked. Keyed by the MIME type we
# will store and serve — a client-supplied type is never trusted.
_IMAGE_SIGNATURES: list[tuple[bytes, str]] = [
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
]

ALLOWED_IMAGE_MIMES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
ALLOWED_VIDEO_MIMES = {"video/mp4", "video/webm"}

# Extensions used on disk. Serving reads the MIME from the database, so this is
# only for making the directory legible to a human.
_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
}


@dataclass
class SniffResult:
    mime: str
    kind: str  # image | video


def sniff(data: bytes) -> SniffResult | None:
    """Identifies a file from its leading bytes. None if it is not allowed.

    Trusting the browser's `Content-Type` would let anyone store a `.html` file
    labelled `image/png` and later get it served back.
    """
    for signature, mime in _IMAGE_SIGNATURES:
        if data.startswith(signature):
            return SniffResult(mime=mime, kind="image")

    # RIFF....WEBP
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return SniffResult(mime="image/webp", kind="image")

    # ISO base media (MP4): a `ftyp` box near the start.
    if data[4:8] == b"ftyp":
        return SniffResult(mime="video/mp4", kind="video")

    # Matroska / WebM share the EBML header; the doctype follows shortly after.
    if data[:4] == b"\x1a\x45\xdf\xa3":
        if b"webm" in data[:64]:
            return SniffResult(mime="video/webm", kind="video")
        return None

    return None


def new_media_id() -> str:
    """Long enough that the URL is not worth guessing at."""
    return secrets.token_urlsafe(24)


def media_root() -> Path:
    return Path(get_settings().media_root)


def path_for(media_id: str, mime: str) -> Path:
    """Builds the on-disk path from our own id.

    Sharded two levels deep so one directory never holds tens of thousands of
    entries. The id is url-safe base64, so it cannot contain a path separator
    or a dot segment — the shape of the input makes traversal impossible.
    """
    safe = media_id.replace("/", "_").replace(".", "_")
    return media_root() / safe[:2] / safe[2:4] / f"{safe}{_EXTENSIONS.get(mime, '.bin')}"


def save(media_id: str, mime: str, data: bytes) -> str:
    """Writes the bytes and returns their sha256."""
    target = path_for(media_id, mime)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return hashlib.sha256(data).hexdigest()


def load(media_id: str, mime: str) -> bytes | None:
    target = path_for(media_id, mime)
    if not target.is_file():
        return None
    return target.read_bytes()


def remove(media_id: str, mime: str) -> None:
    """Deletes the bytes. Missing is fine — the goal is that they are gone."""
    target = path_for(media_id, mime)
    try:
        target.unlink()
    except FileNotFoundError:
        pass
