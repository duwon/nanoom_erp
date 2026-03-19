from fastapi import APIRouter, Depends

from app.dependencies import get_app_store
from app.modules.admin.dependencies import require_admin
from app.modules.admin.permissions.schemas import PermissionsPayload

router = APIRouter()


@router.get("/permissions")
async def list_permissions(
    current_user: dict = Depends(require_admin),
    store=Depends(get_app_store),
) -> list[dict]:
    return [
        {"target": key, "permissions": permissions}
        for key, permissions in sorted(store.permissions.items())
    ]


@router.put("/permissions/{target_type}/{target_id}")
async def update_permissions(
    target_type: str,
    target_id: str,
    payload: PermissionsPayload,
    current_user: dict = Depends(require_admin),
    store=Depends(get_app_store),
) -> list[dict]:
    return store.set_permissions(target_type, target_id, payload.permissions)
