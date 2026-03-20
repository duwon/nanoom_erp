from fastapi import APIRouter, Depends, HTTPException, status

from app.core.store import ConflictError, NotFoundError
from app.dependencies import get_current_user, get_udms_service
from app.modules.udms.schemas import ApprovalCompletedHookPayload, DocumentSummary, ParentDeletedHookPayload
from app.modules.udms.service import UdmsService

router = APIRouter()


def _translate_error(error: Exception) -> HTTPException:
    if isinstance(error, NotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))
    if isinstance(error, ConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    raise error


@router.post("/hooks/approval-completed", response_model=list[DocumentSummary])
async def approval_completed(
    payload: ApprovalCompletedHookPayload,
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> list[DocumentSummary]:
    try:
        documents = await service.lock_approval_documents(
            current_user,
            document_id=payload.document_id,
            target_id=payload.target_id,
        )
        return [DocumentSummary.model_validate(document) for document in documents]
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc


@router.post("/hooks/parent-deleted", response_model=list[DocumentSummary])
async def parent_deleted(
    payload: ParentDeletedHookPayload,
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> list[DocumentSummary]:
    try:
        documents = await service.handle_parent_deleted(
            current_user,
            target_type=payload.target_type,
            target_id=payload.target_id,
            policy=payload.policy,
        )
        return [DocumentSummary.model_validate(document) for document in documents]
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc
