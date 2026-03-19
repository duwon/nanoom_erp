import json
from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
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
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 480
    oauth_state_minutes: int = 10
    auth_cookie_name: str = "nanoom_access_token"
    auth_cookie_secure: bool = False
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

    @property
    def resolved_frontend_app_url(self) -> str:
        if self.frontend_app_url:
            return self.frontend_app_url.rstrip("/")
        return f"http://localhost:{self.frontend_port}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
