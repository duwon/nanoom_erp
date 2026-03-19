from fastapi import APIRouter, Depends, HTTPException, status

from app.core.store import NotFoundError
from app.dependencies import get_app_store, get_current_user
from app.modules.udms.approvals.schemas import ApprovalCreate
from app.modules.udms.dependencies import require_admin

router = APIRouter()


@router.get("/documents/{document_id}/approvals")
async def list_approvals(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    store=Depends(get_app_store),
) -> list[dict]:
    try:
        return store.list_approvals(document_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/documents/{document_id}/approvals")
async def add_approval(
    document_id: str,
    payload: ApprovalCreate,
    current_user: dict = Depends(require_admin),
    store=Depends(get_app_store),
) -> dict:
    try:
        return store.add_approval(document_id, {**payload.model_dump(), "actorId": current_user["id"]})
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
