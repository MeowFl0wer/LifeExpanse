from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, overridable by environment variables."""

    model_config = SettingsConfigDict(env_prefix="LIFE_", env_file=".env", extra="ignore")

    # A real deployment must override this; the default exists so `pytest` and
    # `uvicorn` run out of the box.
    secret_key: str = "dev-only-change-me"
    database_url: str = "sqlite:///./data/lifeexpanse.db"

    session_days: int = 30
    #  Site owner: the only account allowed into /admin.
    site_owner: str = "euan"
    # closed | invite | open
    registration_mode: str = "closed"

    # Origins allowed to call the API with credentials.
    cors_origins: str = "http://localhost:8443,http://localhost:5173"

    trash_retention_days: int = 30
    draft_retention_days: int = 14

    # ---- Accounts ----
    # The single administrative account. It owns no content (需求 3.1).
    admin_username: str = "AdminEuan"
    # Set in the environment to bootstrap the admin on first start. If it is
    # left empty a random password is generated and printed once to the log,
    # so an unconfigured deployment never ends up with a guessable admin.
    admin_bootstrap_password: str = ""

    # ---- Uploads ----
    # Bytes live on disk, not in the database: it keeps a database backup small
    # and lets the media directory be synced separately. Object storage can
    # replace this behind the same `storage` interface later.
    media_root: str = "./data/media"
    max_image_bytes: int = 10 * 1024 * 1024
    max_video_bytes: int = 200 * 1024 * 1024
    # Per-user total. 0 means unlimited.
    storage_quota_bytes: int = 2 * 1024 * 1024 * 1024

    # Longest edge of a generated thumbnail. Display uses these; the original
    # is only fetched when the reader asks to see or download it.
    thumbnail_max_edge: int = 720
    # An unreferenced file is kept this long before the sweep removes it, so a
    # mistaken edit can be undone.
    media_orphan_retention_days: int = 7
    # A file uploaded but never saved into any content — an abandoned editor
    # session. Shorter, because nothing is losing anything.
    media_unattached_retention_hours: int = 24

    # ---- Email verification ----
    verification_code_ttl_minutes: int = 10
    # Guesses allowed against one code before it is burned.
    verification_max_attempts: int = 5
    # How many codes one address may request within the window.
    verification_rate_limit: int = 5
    verification_rate_window_minutes: int = 60

    # console | resend. Resend is wired in later; console prints to the log so
    # the whole flow is testable without an email provider.
    email_backend: str = "console"
    resend_api_key: str = ""
    email_from: str = "LifeExpanse <noreply@example.com>"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
