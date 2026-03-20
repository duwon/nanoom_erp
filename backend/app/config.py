import json
from functools import lru_cache
from typing import Annotated, Literal

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    app_name: str = "Nanoom ERP Demo"
    api_prefix: str = "/api"
    frontend_port: int = 3000
    mongo_url: str = "mongodb://mongo:27017"
    mongo_db: str = "nanoom_erp"
    jwt_secret_key: str = "change-me-in-production-secret-key-123456"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 480
    oauth_state_minutes: int = 10
    auth_cookie_name: str = "nanoom_access_token"
    auth_cookie_secure: bool = False
    auth_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    auth_cookie_domain: str | None = None
    frontend_app_url: str | None = None
    google_oauth_client_id: str | None = None
    google_oauth_client_secret: str | None = None
    kakao_oauth_client_id: str | None = None
    kakao_oauth_client_secret: str | None = None
    auth_dev_seed_enabled: bool = True
    auth_dev_seed_provider: str = "google"
    auth_dev_seed_email: str = "admin@localhost"
    auth_dev_seed_provider_user_id: str = "dev-master"
    auth_dev_seed_name: str = "개발 관리자"
    udms_storage_dir: str = Field(
        default="/app/data/storage",
        validation_alias=AliasChoices("UDMS_STORAGE_DIR", "UDMS_UPLOAD_ROOT"),
    )
    udms_max_upload_bytes: int = 20 * 1024 * 1024
    worship_timezone: str = "Asia/Seoul"
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000"]
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            raw_value = value.strip()
            if raw_value.startswith("["):
                return json.loads(raw_value)
            return [origin.strip() for origin in raw_value.split(",") if origin.strip()]
        raise TypeError("Invalid CORS origins configuration")

    @field_validator("auth_cookie_samesite", mode="before")
    @classmethod
    def normalize_cookie_samesite(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("auth_cookie_domain", "frontend_app_url", mode="before")
    @classmethod
    def empty_string_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @property
    def resolved_frontend_app_url(self) -> str:
        if self.frontend_app_url:
            return self.frontend_app_url.rstrip("/")
        return f"http://localhost:{self.frontend_port}"

    @property
    def udms_upload_root(self) -> str:
        return self.udms_storage_dir


@lru_cache
def get_settings() -> Settings:
    return Settings()
