from app.config import Settings


def test_parse_single_cors_origin_from_env(monkeypatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000")

    settings = Settings()

    assert settings.cors_origins == ["http://localhost:3000"]


def test_parse_comma_separated_cors_origins_from_env(monkeypatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000, https://example.com")

    settings = Settings()

    assert settings.cors_origins == ["http://localhost:3000", "https://example.com"]


def test_auth_cookie_defaults() -> None:
    settings = Settings()

    assert settings.auth_cookie_secure is False
    assert settings.auth_cookie_samesite == "lax"
    assert settings.auth_cookie_domain is None


def test_auth_cookie_env_normalization(monkeypatch) -> None:
    monkeypatch.setenv("AUTH_COOKIE_SAMESITE", "NONE")
    monkeypatch.setenv("AUTH_COOKIE_DOMAIN", " ")

    settings = Settings()

    assert settings.auth_cookie_samesite == "none"
    assert settings.auth_cookie_domain is None
