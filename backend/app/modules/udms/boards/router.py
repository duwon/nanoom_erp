from fastapi import APIRouter, Depends, HTTPException, status

from app.core.store import ConflictError, NotFoundError
from app.dependencies import get_current_user, get_udms_service
from app.modules.udms.schemas import BoardUpsert, UdmsBoard
from app.modules.udms.service import UdmsService

router = APIRouter()


def _translate_error(error: Exception) -> HTTPException:
    if isinstance(error, NotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))
    if isinstance(error, ConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    raise error


@router.get("/boards", response_model=list[UdmsBoard])
async def list_boards(
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> list[UdmsBoard]:
    boards = await service.list_boards(current_user)
    return [UdmsBoard.model_validate(board) for board in boards]


@router.post("/boards", response_model=UdmsBoard)
async def create_board(
    payload: BoardUpsert,
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> UdmsBoard:
    if current_user.get("role") != "master":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    try:
        board = await service.create_board(payload.model_dump())
        return UdmsBoard.model_validate(board)
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc


@router.get("/boards/{board_id}", response_model=UdmsBoard)
async def get_board(
    board_id: str,
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> UdmsBoard:
    boards = await service.list_boards(current_user)
    for board in boards:
        if board["id"] == board_id:
            return UdmsBoard.model_validate(board)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Board '{board_id}' was not found.")


@router.put("/boards/{board_id}", response_model=UdmsBoard)
async def update_board(
    board_id: str,
    payload: BoardUpsert,
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> UdmsBoard:
    if current_user.get("role") != "master":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    try:
        board = await service.update_board(board_id, payload.model_dump())
        return UdmsBoard.model_validate(board)
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc
