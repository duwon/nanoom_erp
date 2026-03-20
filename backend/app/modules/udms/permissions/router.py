from fastapi import APIRouter, Depends, HTTPException, status

from app.core.store import ConflictError, NotFoundError
from app.dependencies import get_current_user, get_udms_service
from app.modules.udms.schemas import BoardPermissionRule, BoardPermissionRuleInput
from app.modules.udms.service import UdmsService

router = APIRouter()


def _translate_error(error: Exception) -> HTTPException:
    if isinstance(error, NotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))
    if isinstance(error, ConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    raise error


@router.get("/permissions", response_model=list[BoardPermissionRule])
async def list_permissions(
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> list[BoardPermissionRule]:
    try:
        rules = await service.list_board_permissions(current_user)
        return [BoardPermissionRule.model_validate(rule) for rule in rules]
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc


@router.put("/boards/{board_id}/permissions", response_model=list[BoardPermissionRule])
async def replace_board_permissions(
    board_id: str,
    payload: list[BoardPermissionRuleInput],
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> list[BoardPermissionRule]:
    try:
        rules = await service.set_board_permissions(
            current_user,
            board_id,
            [item.model_dump() for item in payload],
        )
        return [BoardPermissionRule.model_validate(rule) for rule in rules]
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc
