from fastapi import Depends

from app.core.permissions import ensure_roles
from app.dependencies import get_current_user


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    ensure_roles(current_user.get("role"), {"master"})
    return current_user
