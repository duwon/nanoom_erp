from fastapi import APIRouter, Depends, HTTPException, status

from app.core.store import NotFoundError
from app.dependencies import get_app_store, get_current_user
from app.modules.udms.dependencies import require_admin, require_editor_or_admin
from app.modules.udms.documents.schemas import AttachmentCreate, DocumentCreate, DocumentUpdate

router = APIRouter()


@router.get("/documents")
async def list_documents(
    boardId: str | None = None,
    q: str | None = None,
    current_user: dict = Depends(get_current_user),
    store=Depends(get_app_store),
) -> list[dict]:
    return store.list_documents(board_id=boardId, query=q)


@router.post("/documents")
async def create_document(
    payload: DocumentCreate,
    current_user: dict = Depends(require_editor_or_admin),
    store=Depends(get_app_store),
) -> dict:
    return store.create_document({**payload.model_dump(), "actorId": current_user["id"]})


@router.get("/documents/{document_id}")
async def get_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    store=Depends(get_app_store),
) -> dict:
    try:
        return store.get_document(document_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/documents/{document_id}")
async def update_document(
    document_id: str,
    payload: DocumentUpdate,
    current_user: dict = Depends(require_editor_or_admin),
    store=Depends(get_app_store),
) -> dict:
    try:
        return store.update_document(
            document_id,
            {**payload.model_dump(exclude_unset=True), "actorId": current_user["id"]},
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/documents/{document_id}/versions")
async def list_versions(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    store=Depends(get_app_store),
) -> list[dict]:
    try:
        return store.list_document_versions(document_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/audit-logs")
async def list_audit_logs(
    current_user: dict = Depends(require_admin),
    store=Depends(get_app_store),
) -> list[dict]:
    return store.list_audit_logs()
