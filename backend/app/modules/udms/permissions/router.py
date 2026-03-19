from fastapi import APIRouter, Depends

from app.dependencies import get_app_store
from app.modules.udms.dependencies import require_admin
from app.modules.udms.permissions.schemas import PermissionsPayload

router = APIRouter()


@router.get("/documents/{document_id}/permissions")
async def get_document_permissions(
    document_id: str,
    current_user: dict = Depends(require_admin),
    store=Depends(get_app_store),
) -> list[dict]:
    return store.get_permissions("document", document_id)


@router.put("/documents/{document_id}/permissions")
async def update_document_permissions(
    document_id: str,
    payload: PermissionsPayload,
    current_user: dict = Depends(require_admin),
    store=Depends(get_app_store),
) -> list[dict]:
    return store.set_permissions("document", document_id, payload.permissions)
