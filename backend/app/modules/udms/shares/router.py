from fastapi import APIRouter, Depends, HTTPException, status

from app.core.store import ConflictError, NotFoundError
from app.dependencies import get_current_user, get_udms_service
from app.modules.udms.schemas import SharedDocumentsOverview
from app.modules.udms.service import UdmsService

router = APIRouter()


def _translate_error(error: Exception) -> HTTPException:
    if isinstance(error, NotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))
    if isinstance(error, ConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    raise error


@router.get("/docs/shared", response_model=SharedDocumentsOverview)
async def list_shared_documents(
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> SharedDocumentsOverview:
    try:
        overview = await service.list_shared_documents(current_user)
        return SharedDocumentsOverview.model_validate(overview)
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc
