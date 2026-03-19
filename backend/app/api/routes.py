from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_worship_service
from app.db.repository import OrderItemNotFoundError
from app.schemas.display import DisplayState
from app.schemas.order_item import OrderItem, OrderItemUpdate
from app.services.worship_service import WorshipService

router = APIRouter()


@router.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/order-items", response_model=list[OrderItem])
async def list_order_items(
    service: WorshipService = Depends(get_worship_service),
) -> list[OrderItem]:
    return await service.list_order_items()


@router.put("/order-items/{item_id}", response_model=OrderItem)
async def update_order_item(
    item_id: str,
    payload: OrderItemUpdate,
    service: WorshipService = Depends(get_worship_service),
) -> OrderItem:
    try:
        return await service.update_order_item(item_id, payload)
    except OrderItemNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post("/order-items/{item_id}/activate", response_model=DisplayState)
async def activate_order_item(
    item_id: str,
    service: WorshipService = Depends(get_worship_service),
) -> DisplayState:
    try:
        return await service.activate_order_item(item_id)
    except OrderItemNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get("/display-state", response_model=DisplayState)
async def get_display_state(
    service: WorshipService = Depends(get_worship_service),
) -> DisplayState:
    return await service.get_display_state()
