from fastapi import APIRouter, Depends, HTTPException, status

from app.core.store import NotFoundError
from app.dependencies import get_app_store, get_current_user
from app.modules.admin.dependencies import require_admin
from app.modules.udms.boards.schemas import BoardUpsert

router = APIRouter()


@router.get("/boards")
async def list_boards(
    current_user: dict = Depends(require_admin),
    store=Depends(get_app_store),
) -> list[dict]:
    return store.list_boards()


@router.post("/boards")
async def create_board(
    payload: BoardUpsert,
    current_user: dict = Depends(require_admin),
    store=Depends(get_app_store),
) -> dict:
    return store.create_board(payload.model_dump())


@router.put("/boards/{board_id}")
async def update_board(
    board_id: str,
    payload: BoardUpsert,
    current_user: dict = Depends(require_admin),
    store=Depends(get_app_store),
) -> dict:
    try:
        return store.update_board(board_id, payload.model_dump())
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
