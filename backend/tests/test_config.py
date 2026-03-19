from app.config import Settings


def test_parse_single_cors_origin_from_env(monkeypatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000")

    settings = Settings()

    assert settings.cors_origins == ["http://localhost:3000"]


def test_parse_comma_separated_cors_origins_from_env(monkeypatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000, https://example.com")

    settings = Settings()

    assert settings.cors_origins == ["http://localhost:3000", "https://example.com"]
