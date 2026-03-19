from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.main import create_app
from app.modules.users.repository import UserRepository
from app.schemas.display import DisplayState
from app.services.oauth_service import OAuthService
from app.schemas.order_item import OrderItem, OrderItemUpdate
from app.services.worship_service import WorshipService
from app.ws.connection_manager import ConnectionManager


class FakeRepository:
    def __init__(self):
        now = datetime.now(timezone.utc)
        self.items = [
            OrderItem(
                id="opening",
                title="예배 시작",
                order=1,
                content="예배를 여는 찬양",
                isActive=True,
                updatedAt=now,
            ),
            OrderItem(
                id="sermon",
                title="말씀",
                order=2,
                content="본문",
                isActive=False,
                updatedAt=now,
            ),
        ]

    async def ensure_indexes(self) -> None:
        return None

    async def seed_defaults_if_empty(self) -> None:
        return None

    async def list_order_items(self) -> list[OrderItem]:
        return sorted(self.items, key=lambda item: item.order)

    async def update_order_item(self, item_id: str, payload: OrderItemUpdate) -> OrderItem:
        for index, item in enumerate(self.items):
            if item.id == item_id:
                updated = item.model_copy(
                    update={
                        "title": payload.title,
                        "content": payload.content,
                        "updatedAt": datetime.now(timezone.utc),
                    }
                )
                self.items[index] = updated
                return updated
        raise AssertionError("Item not found")

    async def activate_order_item(self, item_id: str) -> OrderItem:
        now = datetime.now(timezone.utc)
        selected_item = None
        updated_items: list[OrderItem] = []
        for item in self.items:
            is_active = item.id == item_id
            updated_item = item.model_copy(
                update={"isActive": is_active, "updatedAt": now if is_active else item.updatedAt}
            )
            if is_active:
                selected_item = updated_item
            updated_items.append(updated_item)

        if selected_item is None:
            raise AssertionError("Item not found")

        self.items = updated_items
        return selected_item

    async def get_display_state(self) -> DisplayState:
        active_item = next((item for item in self.items if item.isActive), None)
        if active_item is None:
            return DisplayState(
                activeItemId=None,
                title="송출 대기 중",
                content="관리자 화면에서 순서를 선택해 주세요.",
                updatedAt=None,
            )
        return DisplayState(
            activeItemId=active_item.id,
            title=active_item.title,
            content=active_item.content,
            updatedAt=active_item.updatedAt,
        )


def create_test_client(
    user_repository: UserRepository | None = None,
    oauth_service: OAuthService | None = None,
) -> TestClient:
    service = WorshipService(FakeRepository(), ConnectionManager())
    return TestClient(
        create_app(
            service=service,
            user_repository=user_repository,
            oauth_service=oauth_service,
        )
    )


def test_health_check() -> None:
    client = create_test_client()
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_list_order_items() -> None:
    client = create_test_client()
    response = client.get("/api/order-items")
    payload = response.json()

    assert response.status_code == 200
    assert len(payload) == 2
    assert payload[0]["id"] == "opening"


def test_update_order_item() -> None:
    client = create_test_client()
    response = client.put(
        "/api/order-items/sermon",
        json={"title": "말씀 선포", "content": "업데이트된 본문"},
    )
    payload = response.json()

    assert response.status_code == 200
    assert payload["title"] == "말씀 선포"
    assert payload["content"] == "업데이트된 본문"


def test_activate_order_item_and_broadcast() -> None:
    client = create_test_client()

    with client.websocket_connect("/ws/display") as websocket:
        initial_event = websocket.receive_json()
        assert initial_event["type"] == "display.updated"
        assert initial_event["payload"]["activeItemId"] == "opening"

        response = client.post("/api/order-items/sermon/activate")
        event = websocket.receive_json()

    assert response.status_code == 200
    assert event["type"] == "display.updated"
    assert event["payload"]["activeItemId"] == "sermon"
