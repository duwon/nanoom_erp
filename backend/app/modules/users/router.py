from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_authenticated_user, get_user_repository
from app.modules.users.schemas import User, UserProfileUpdate

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
