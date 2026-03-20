from fastapi import APIRouter, Depends, HTTPException, status

from app.config import get_settings
from app.dependencies import get_current_user, get_authenticated_user, get_user_repository
from app.modules.users.schemas import DevRoleSwitchPayload, User, UserProfileUpdate, UserRole, UserStatus

router = APIRouter()


@router.put("/me/profile", response_model=User)
async def update_my_profile(
    payload: UserProfileUpdate,
    current_user: dict = Depends(get_authenticated_user),
    repository=Depends(get_user_repository),
) -> User:
    if current_user.get("status") == "blocked":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Blocked users cannot update profile",
        )

    updated = await repository.update_profile(current_user["id"], payload.model_dump())
    return User.model_validate(updated)


@router.get("/active", response_model=list[User])
async def list_active_users(
    current_user: dict = Depends(get_current_user),
    repository=Depends(get_user_repository),
) -> list[User]:
    del current_user
    users = await repository.list_active_users()
    return [User.model_validate(user) for user in users]


@router.put("/me/dev-role", response_model=User)
async def switch_my_dev_role(
    payload: DevRoleSwitchPayload,
    current_user: dict = Depends(get_current_user),
    repository=Depends(get_user_repository),
) -> User:
    settings = get_settings()
    if not settings.auth_dev_seed_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dev role switch is disabled")

    expected_provider = settings.auth_dev_seed_provider.strip().lower()
    if (
        current_user.get("email") != settings.auth_dev_seed_email
        or current_user.get("provider_user_id") != settings.auth_dev_seed_provider_user_id
        or str(current_user.get("social_provider", "")).strip().lower() != expected_provider
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Dev role switch is only available for the dev seed account")

    if payload.role not in {UserRole.master, UserRole.editor}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Dev role switch only supports master and editor")

    updated = await repository.admin_update_user(
        current_user["id"],
        {"role": payload.role.value, "status": UserStatus.active.value},
        actor_id=current_user["id"],
    )
    return User.model_validate(updated)
