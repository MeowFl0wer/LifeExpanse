"""Migrations are exercised against a database that already holds data.

An empty database hides most migration bugs: NOT NULL columns with no default,
unnamed constraints, and uniqueness added over existing duplicates all pass on
a fresh schema and fail on a real one. Every bug this file guards against was
found this way rather than by the ordinary suite.
"""

import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]

# The revision immediately before display_name became unique.
BEFORE_UNIQUE_DISPLAY_NAME = "ab50114ee862"


def alembic(db_path: str, *args: str):
    return subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND,
        capture_output=True,
        text=True,
        env={
            "PATH": "/usr/bin:/bin",
            "LIFE_DATABASE_URL": f"sqlite:///{db_path}",
            "LIFE_SECRET_KEY": "migration-test",
            "PYTHONPATH": str(BACKEND),
        },
        timeout=180,
    )


def insert_user(db_path: str, uid: str, username: str, display_name: str, created: str):
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            "INSERT INTO users (id, username, email, display_name, bio, password_hash,"
            " is_active, role, can_upload_image, can_upload_video, totp_enabled,"
            " login_count, created_at, email_verified, backup_email_verified)"
            " VALUES (?, ?, ?, ?, '', 'hash', 1, 'user', 1, 0, 0, 0, ?, 0, 0)",
            (uid, username, f"{username}@example.com", display_name, created),
        )


def display_names(db_path: str) -> dict[str, str]:
    with sqlite3.connect(db_path) as conn:
        return {
            row[0]: row[1]
            for row in conn.execute("SELECT username, display_name FROM users")
        }


def test_upgrading_a_database_with_duplicate_display_names(tmp_path):
    """Duplicates, case-equivalents and blanks all violate the new constraint.

    Without the cleanup pass this fails with `UNIQUE constraint failed` — during
    a deploy, which is the worst moment to discover it.
    """
    db = str(tmp_path / "dirty.db")
    assert alembic(db, "upgrade", BEFORE_UNIQUE_DISPLAY_NAME).returncode == 0

    insert_user(db, "1", "alice", "Euan", "2024-01-01")
    insert_user(db, "2", "bob", "euan", "2024-01-02")     # case-equivalent
    insert_user(db, "3", "carol", "", "2024-01-03")        # blank
    insert_user(db, "4", "dave", "", "2024-01-04")         # second blank
    insert_user(db, "5", "erin", "Euan", "2024-01-05")     # exact duplicate

    result = alembic(db, "upgrade", "head")
    assert result.returncode == 0, result.stderr

    names = display_names(db)
    # The oldest holder keeps the name they had.
    assert names["alice"] == "Euan"
    # Everyone else falls back to their username, which is unique already.
    assert names["bob"] == "bob"
    assert names["carol"] == "carol"
    assert names["dave"] == "dave"
    assert names["erin"] == "erin"

    # And the result really is unique, case-insensitively.
    lowered = [n.lower() for n in names.values()]
    assert len(lowered) == len(set(lowered))


def test_nobody_loses_their_account_to_the_cleanup(tmp_path):
    db = str(tmp_path / "dirty.db")
    alembic(db, "upgrade", BEFORE_UNIQUE_DISPLAY_NAME)
    for i, name in enumerate(["alice", "bob", "carol"], start=1):
        insert_user(db, str(i), name, "同一个昵称", f"2024-01-0{i}")

    assert alembic(db, "upgrade", "head").returncode == 0
    assert len(display_names(db)) == 3


def test_a_clean_database_is_left_alone(tmp_path):
    db = str(tmp_path / "clean.db")
    alembic(db, "upgrade", BEFORE_UNIQUE_DISPLAY_NAME)
    insert_user(db, "1", "alice", "Alice", "2024-01-01")
    insert_user(db, "2", "bob", "Bob", "2024-01-02")

    assert alembic(db, "upgrade", "head").returncode == 0
    assert display_names(db) == {"alice": "Alice", "bob": "Bob"}


def test_upgrading_a_database_that_already_has_media(tmp_path):
    """`has_thumbnail` and `thumbnail_state` are NOT NULL; existing rows need a
    default or the ALTER fails."""
    db = str(tmp_path / "media.db")
    assert alembic(db, "upgrade", "90050e90fafa").returncode == 0

    insert_user(db, "1", "euan", "Euan", "2024-01-01")
    with sqlite3.connect(db) as conn:
        conn.execute(
            "INSERT INTO media_files (id, owner_id, kind, mime, size_bytes, sha256,"
            " original_name, visibility, created_at)"
            " VALUES ('m1', '1', 'image', 'image/png', 100, 'abc', 'a.png',"
            " 'private', '2024-01-01')"
        )

    result = alembic(db, "upgrade", "head")
    assert result.returncode == 0, result.stderr

    with sqlite3.connect(db) as conn:
        row = conn.execute(
            "SELECT has_thumbnail, thumbnail_state FROM media_files"
        ).fetchone()
    # Pre-existing files already have their thumbnails, so they must not be
    # queued for regeneration on the next boot.
    assert row == (0, "ready")


def test_the_whole_chain_is_reversible(tmp_path):
    db = str(tmp_path / "chain.db")
    assert alembic(db, "upgrade", "head").returncode == 0
    assert alembic(db, "downgrade", "base").returncode == 0
    assert alembic(db, "upgrade", "head").returncode == 0
