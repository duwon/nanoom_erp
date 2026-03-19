from fastapi import APIRouter, Depends

from app.dependencies import get_user_repository
from app.modules.admin.dependencies import require_admin
from app.modules.users.schemas import AdminUserUpdate, User

router = APIRouter()


@router.get("/users", response_model=list[User])
async def list_users(
    current_user: dict = Depends(require_admin),
    repository=Depends(get_user_repository),
) -> list[User]:
    users = await repository.list_users()
    return [User.model_validate(user) for user in users]


@router.put("/users/{user_id}", response_model=User)
async def update_user(
    user_id: str,
    payload: AdminUserUpdate,
    current_user: dict = Depends(require_admin),
    repository=Depends(get_user_repository),
) -> User:
    updated = await repository.admin_update_user(
        user_id,
        payload.model_dump(exclude_unset=True, mode="json"),
        actor_id=current_user["id"],
    )
    return User.model_validate(updated)
