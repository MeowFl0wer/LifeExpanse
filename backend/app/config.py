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

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
