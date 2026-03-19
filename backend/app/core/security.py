from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from fastapi import HTTPException, Request, status
from jwt import ExpiredSignatureError, InvalidTokenError

from app.config import get_settings
from app.modules.users.repository import UserNotFoundError


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _encode_token(payload: dict[str, Any], expires_minutes: int) -> str:
    settings = get_settings()
    now = _utcnow()
    token_payload = {
        **payload,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=expires_minutes)).timestamp()),
    }
    return jwt.encode(token_payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def _decode_token(token: str, expected_type: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "iat", "type"]},
        )
    except ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired",
        ) from exc
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        ) from exc

    if payload.get("type") != expected_type:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )
    return payload


def create_access_token(user_id: str) -> str:
    settings = get_settings()
    return _encode_token({"sub": user_id, "type": "access"}, settings.access_token_minutes)


def decode_access_token(token: str) -> dict[str, Any]:
    return _decode_token(token, expected_type="access")


def create_oauth_state_token(payload: dict[str, Any]) -> str:
    settings = get_settings()
    return _encode_token({"type": "oauth_state", **payload}, settings.oauth_state_minutes)


def decode_oauth_state_token(token: str, expected_provider: str) -> dict[str, Any]:
    payload = _decode_token(token, expected_type="oauth_state")
    if payload.get("provider") != expected_provider:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OAuth state",
        )
    return payload


def get_auth_token_from_request(request: Request) -> str:
    settings = get_settings()
    token = request.cookies.get(settings.auth_cookie_name)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return token


async def get_authenticated_user(request: Request) -> dict[str, Any]:
    payload = decode_access_token(get_auth_token_from_request(request))
    user_id = payload.get("sub")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    repository = getattr(request.app.state, "user_repository", None)
    if repository is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="User repository is not ready",
        )

    try:
        return await repository.get_user(user_id)
    except UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        ) from exc


async def get_current_user(request: Request) -> dict[str, Any]:
    user = await get_authenticated_user(request)
    status_value = user.get("status")
    if status_value == "active":
        return user
    if status_value == "pending":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User approval is pending",
        )
    if status_value == "blocked":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is blocked",
        )
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="User is unavailable",
    )
