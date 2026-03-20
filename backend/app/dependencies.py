from fastapi import Depends, HTTPException, Request, status

from app.core.security import (
    get_authenticated_user as resolve_authenticated_user,
    get_current_user as resolve_current_user,
)
from app.core.store import InMemoryAppStore
from app.modules.udms.service import UdmsService
from app.services.oauth_service import OAuthService
from app.services.worship_service import WorshipService


def get_app_store(request: Request) -> InMemoryAppStore:
    store = getattr(request.app.state, "store", None)
    if store is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Store is not ready",
        )
    return store


def get_worship_service(request: Request) -> WorshipService:
    service = getattr(request.app.state, "service", None)
    if service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service is not ready",
        )
    return service


def get_udms_service(request: Request) -> UdmsService:
    service = getattr(request.app.state, "udms_service", None)
    if service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="UDMS service is not ready",
        )
    return service


def get_user_repository(request: Request):
    repository = getattr(request.app.state, "user_repository", None)
    if repository is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="User repository is not ready",
        )
    return repository


def get_oauth_service(request: Request) -> OAuthService:
    service = getattr(request.app.state, "oauth_service", None)
    if service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OAuth service is not ready",
        )
    return service


async def get_authenticated_user(request: Request) -> dict:
    return await resolve_authenticated_user(request)


async def get_current_user(request: Request) -> dict:
    return await resolve_current_user(request)


async def get_current_admin_user(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "master":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user
