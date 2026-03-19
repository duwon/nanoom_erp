from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol
from urllib.parse import urlencode

import httpx

from app.config import get_settings
from app.modules.users.schemas import SocialProvider


@dataclass(slots=True)
class OAuthIdentity:
    provider: SocialProvider
    provider_user_id: str
    email: str
    name: str | None = None


class OAuthError(Exception):
    pass


class OAuthConfigurationError(OAuthError):
    pass


class OAuthService(Protocol):
    def is_configured(self, provider: SocialProvider) -> bool: ...

    def is_dev_seed_available(self, provider: SocialProvider) -> bool: ...

    def build_authorization_url(
        self,
        provider: SocialProvider,
        redirect_uri: str,
        state: str,
    ) -> str: ...

    async def exchange_code(
        self,
        provider: SocialProvider,
        code: str,
        redirect_uri: str,
    ) -> OAuthIdentity: ...


class HttpOAuthService:
    GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
    GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"

    KAKAO_AUTH_URL = "https://kauth.kakao.com/oauth/authorize"
    KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token"
    KAKAO_USERINFO_URL = "https://kapi.kakao.com/v2/user/me"

    DEV_SEED_CODE = "__dev_seed__"

    def __init__(self) -> None:
        self.settings = get_settings()

    def is_configured(self, provider: SocialProvider) -> bool:
        if provider == SocialProvider.google:
            return bool(self.settings.google_oauth_client_id and self.settings.google_oauth_client_secret)
        return bool(self.settings.kakao_oauth_client_id)

    def is_dev_seed_available(self, provider: SocialProvider) -> bool:
        return (
            self.settings.auth_dev_seed_enabled
            and provider.value == self.settings.auth_dev_seed_provider
            and bool(self.settings.auth_dev_seed_email)
            and bool(self.settings.auth_dev_seed_provider_user_id)
        )

    def build_authorization_url(
        self,
        provider: SocialProvider,
        redirect_uri: str,
        state: str,
    ) -> str:
        if provider == SocialProvider.google:
            if not self.is_configured(provider):
                raise OAuthConfigurationError("Google OAuth is not configured")
            params = {
                "client_id": self.settings.google_oauth_client_id,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": "openid email profile",
                "state": state,
                "prompt": "select_account",
            }
            return f"{self.GOOGLE_AUTH_URL}?{urlencode(params)}"

        if not self.is_configured(provider):
            raise OAuthConfigurationError("Kakao OAuth is not configured")
        params = {
            "client_id": self.settings.kakao_oauth_client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "account_email profile_nickname",
            "state": state,
        }
        return f"{self.KAKAO_AUTH_URL}?{urlencode(params)}"

    async def exchange_code(
        self,
        provider: SocialProvider,
        code: str,
        redirect_uri: str,
    ) -> OAuthIdentity:
        if code == self.DEV_SEED_CODE and self.is_dev_seed_available(provider):
            return OAuthIdentity(
                provider=provider,
                provider_user_id=self.settings.auth_dev_seed_provider_user_id,
                email=self.settings.auth_dev_seed_email,
                name=self.settings.auth_dev_seed_name,
            )

        if provider == SocialProvider.google:
            return await self._exchange_google_code(code, redirect_uri)
        return await self._exchange_kakao_code(code, redirect_uri)

    async def _exchange_google_code(self, code: str, redirect_uri: str) -> OAuthIdentity:
        if not self.is_configured(SocialProvider.google):
            raise OAuthConfigurationError("Google OAuth is not configured")

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                token_response = await client.post(
                    self.GOOGLE_TOKEN_URL,
                    data={
                        "code": code,
                        "client_id": self.settings.google_oauth_client_id,
                        "client_secret": self.settings.google_oauth_client_secret,
                        "redirect_uri": redirect_uri,
                        "grant_type": "authorization_code",
                    },
                    headers={"Accept": "application/json"},
                )
                token_response.raise_for_status()
                access_token = token_response.json().get("access_token")
                if not access_token:
                    raise OAuthError("Google access token was not returned")

                profile_response = await client.get(
                    self.GOOGLE_USERINFO_URL,
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                profile_response.raise_for_status()
            except httpx.HTTPError as exc:
                raise OAuthError("Google login failed") from exc

        payload = profile_response.json()
        email = payload.get("email")
        provider_user_id = payload.get("sub")
        if not email:
            raise OAuthError("Google account email is required")
        if not provider_user_id:
            raise OAuthError("Google account identifier is missing")

        return OAuthIdentity(
            provider=SocialProvider.google,
            provider_user_id=str(provider_user_id),
            email=email,
            name=payload.get("name"),
        )

    async def _exchange_kakao_code(self, code: str, redirect_uri: str) -> OAuthIdentity:
        if not self.is_configured(SocialProvider.kakao):
            raise OAuthConfigurationError("Kakao OAuth is not configured")

        form_data = {
            "grant_type": "authorization_code",
            "client_id": self.settings.kakao_oauth_client_id,
            "redirect_uri": redirect_uri,
            "code": code,
        }
        if self.settings.kakao_oauth_client_secret:
            form_data["client_secret"] = self.settings.kakao_oauth_client_secret

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                token_response = await client.post(
                    self.KAKAO_TOKEN_URL,
                    data=form_data,
                    headers={"Accept": "application/json"},
                )
                token_response.raise_for_status()
                access_token = token_response.json().get("access_token")
                if not access_token:
                    raise OAuthError("Kakao access token was not returned")

                profile_response = await client.get(
                    self.KAKAO_USERINFO_URL,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Accept": "application/json",
                    },
                )
                profile_response.raise_for_status()
            except httpx.HTTPError as exc:
                raise OAuthError("Kakao login failed") from exc

        payload = profile_response.json()
        account = payload.get("kakao_account", {})
        profile = account.get("profile", {}) if isinstance(account, dict) else {}
        email = account.get("email") if isinstance(account, dict) else None
        provider_user_id = payload.get("id")
        if not email:
            raise OAuthError("카카오 계정 이메일 제공 동의가 필요합니다")
        if not provider_user_id:
            raise OAuthError("Kakao account identifier is missing")

        return OAuthIdentity(
            provider=SocialProvider.kakao,
            provider_user_id=str(provider_user_id),
            email=email,
            name=profile.get("nickname") or payload.get("properties", {}).get("nickname"),
        )
