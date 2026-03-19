from __future__ import annotations

from typing import Annotated
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import RedirectResponse

from app.config import get_settings
from app.core.security import create_access_token, create_oauth_state_token, decode_oauth_state_token
from app.dependencies import get_authenticated_user, get_oauth_service, get_user_repository
from app.modules.auth.schemas import AuthUser, SocialProvider
from app.modules.users.schemas import User, is_profile_complete
from app.services.oauth_service import OAuthConfigurationError, OAuthError, OAuthService

router = APIRouter()


def _issue_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        max_age=settings.access_token_minutes * 60,
        domain=settings.auth_cookie_domain,
        path="/",
    )


def _frontend_url() -> str:
    return get_settings().resolved_frontend_app_url


def _normalize_next_path(value: str | None) -> str:
    if not value or not value.startswith("/") or value.startswith("//"):
        return "/"
    if value in {"/login", "/onboarding", "/pending", "/blocked"}:
        return "/"
    return value


def _build_frontend_redirect(path: str) -> str:
    return f"{_frontend_url()}{path}"


def _build_login_redirect(error_message: str) -> str:
    query = urlencode({"error": error_message})
    return f"{_frontend_url()}/login?{query}"


def _resolve_post_login_path(user: dict, requested_next: str) -> str:
    default_path = "/admin" if user.get("role") == "master" else "/dashboard"
    if not is_profile_complete(user):
        return "/onboarding"
    if user.get("status") == "pending":
        return "/pending"
    if user.get("status") == "blocked":
        return "/blocked"
    if requested_next == "/":
        return default_path
    if requested_next.startswith("/admin") and user.get("role") != "master":
        return default_path
    return requested_next or default_path


@router.get("/oauth/{provider}/start")
async def oauth_start(
    provider: SocialProvider,
    request: Request,
    next_path: Annotated[str | None, Query(alias="next")] = None,
    oauth_service: OAuthService = Depends(get_oauth_service),
) -> RedirectResponse:
    requested_next = _normalize_next_path(next_path)
    state = create_oauth_state_token({"provider": provider.value, "next": requested_next})
    callback_url = str(request.url_for("oauth_callback", provider=provider.value))

    if oauth_service.is_dev_seed_available(provider) and not oauth_service.is_configured(provider):
        query = urlencode({"code": "__dev_seed__", "state": state})
        return RedirectResponse(url=f"{callback_url}?{query}", status_code=307)

    try:
        authorization_url = oauth_service.build_authorization_url(provider, callback_url, state)
    except OAuthConfigurationError as exc:
        return RedirectResponse(url=_build_login_redirect(str(exc)), status_code=307)

    return RedirectResponse(url=authorization_url, status_code=307)


@router.get("/oauth/{provider}/callback", name="oauth_callback")
async def oauth_callback(
    provider: SocialProvider,
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    oauth_service: OAuthService = Depends(get_oauth_service),
    repository=Depends(get_user_repository),
) -> RedirectResponse:
    if error:
        return RedirectResponse(url=_build_login_redirect(error), status_code=307)
    if not code or not state:
        return RedirectResponse(url=_build_login_redirect("OAuth callback is incomplete"), status_code=307)

    try:
        state_payload = decode_oauth_state_token(state, provider.value)
    except Exception:
        return RedirectResponse(url=_build_login_redirect("Invalid OAuth state"), status_code=307)

    requested_next = _normalize_next_path(state_payload.get("next"))
    callback_url = str(request.url_for("oauth_callback", provider=provider.value))

    try:
        identity = await oauth_service.exchange_code(provider, code, callback_url)
        user = await repository.login_with_oauth(identity)
    except OAuthError as exc:
        return RedirectResponse(url=_build_login_redirect(str(exc)), status_code=307)

    redirect_target = _build_frontend_redirect(_resolve_post_login_path(user, requested_next))
    response = RedirectResponse(url=redirect_target, status_code=307)
    _issue_cookie(response, create_access_token(user["id"]))
    return response


@router.post("/logout")
async def logout(response: Response) -> dict[str, str]:
    settings = get_settings()
    response.delete_cookie(
        settings.auth_cookie_name,
        domain=settings.auth_cookie_domain,
        path="/",
    )
    return {"status": "ok"}


@router.get("/me", response_model=AuthUser)
async def me(current_user: dict = Depends(get_authenticated_user)) -> User:
    return User.model_validate(current_user)
