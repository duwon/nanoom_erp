from fastapi import APIRouter, Depends, HTTPException, status

from app.core.store import ConflictError, NotFoundError
from app.dependencies import get_current_user, get_udms_service
from app.modules.udms.schemas import DocumentShare, DocumentShareInput, SharedDocumentOverview
from app.modules.udms.service import UdmsService

router = APIRouter()


def _translate_error(error: Exception) -> HTTPException:
    if isinstance(error, NotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))
    if isinstance(error, ConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    raise error


@router.get("/shares", response_model=SharedDocumentOverview)
async def list_shared_documents(
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> SharedDocumentOverview:
    overview = await service.list_shared_documents(current_user)
    return SharedDocumentOverview.model_validate(overview)


@router.get("/documents/{document_id}/shares", response_model=list[DocumentShare])
async def list_shares(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> list[DocumentShare]:
    try:
        shares = await service.list_shares(current_user, document_id)
        return [DocumentShare.model_validate(share) for share in shares]
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc


@router.put("/documents/{document_id}/shares", response_model=list[DocumentShare])
async def replace_shares(
    document_id: str,
    payload: list[DocumentShareInput],
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> list[DocumentShare]:
    try:
        shares = await service.replace_shares(
            current_user,
            document_id,
            [item.model_dump() for item in payload],
        )
        return [DocumentShare.model_validate(share) for share in shares]
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc
