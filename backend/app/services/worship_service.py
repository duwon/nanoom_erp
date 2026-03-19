from app.db.repository import WorshipRepository
from app.schemas.display import DisplayState
from app.schemas.order_item import OrderItem, OrderItemUpdate
from app.ws.connection_manager import ConnectionManager


class WorshipService:
    def __init__(
        self,
        repository: WorshipRepository,
        ws_manager: ConnectionManager,
    ):
        self.repository = repository
        self.ws_manager = ws_manager

    async def seed_defaults(self) -> None:
        await self.repository.seed_defaults_if_empty()

    async def list_order_items(self) -> list[OrderItem]:
        return await self.repository.list_order_items()

    async def update_order_item(
        self,
        item_id: str,
        payload: OrderItemUpdate,
    ) -> OrderItem:
        return await self.repository.update_order_item(item_id, payload)

    async def activate_order_item(self, item_id: str) -> DisplayState:
        item = await self.repository.activate_order_item(item_id)
        display_state = DisplayState(
            activeItemId=item.id,
            title=item.title,
            content=item.content,
            updatedAt=item.updatedAt,
        )
        await self.ws_manager.broadcast(
            "display.updated",
            display_state.model_dump(mode="json"),
        )
        return display_state

    async def get_display_state(self) -> DisplayState:
        return await self.repository.get_display_state()
