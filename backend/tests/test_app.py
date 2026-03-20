from fastapi.testclient import TestClient

from app.main import create_app
from app.modules.udms.repository import UdmsRepository
from app.modules.users.repository import UserRepository
from app.modules.worship.adapters import (
    InMemoryScriptureAdapter,
    InMemorySongCatalogAdapter,
    NoopPresentationAdapter,
)
from app.modules.worship.repository import InMemoryWorshipRepository
from app.services.oauth_service import OAuthService
from app.services.worship_service import WorshipService
from app.ws.connection_manager import ConnectionManager


def build_test_worship_service(
    repository: InMemoryWorshipRepository | None = None,
) -> WorshipService:
    return WorshipService(
        repository or InMemoryWorshipRepository.bootstrap(),
        ConnectionManager(),
        song_adapter=InMemorySongCatalogAdapter(),
        scripture_adapter=InMemoryScriptureAdapter(),
        presentation_adapter=NoopPresentationAdapter(),
        frontend_app_url="http://localhost:3000",
    )


def create_test_client(
    user_repository: UserRepository | None = None,
    udms_repository: UdmsRepository | None = None,
    oauth_service: OAuthService | None = None,
    service: WorshipService | None = None,
) -> TestClient:
    return TestClient(
        create_app(
            service=service or build_test_worship_service(),
            user_repository=user_repository,
            udms_repository=udms_repository,
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
    assert len(payload) >= 3
    assert payload == sorted(payload, key=lambda item: item["order"])
    assert payload[0]["title"]


def test_update_order_item() -> None:
    client = create_test_client()
    item_id = client.get("/api/order-items").json()[0]["id"]

    response = client.put(
        f"/api/order-items/{item_id}",
        json={"title": "말씀 선포", "content": "업데이트된 본문"},
    )
    payload = response.json()

    assert response.status_code == 200
    assert payload["id"] == item_id
    assert payload["title"] == "말씀 선포"
    assert payload["content"] == "업데이트된 본문"


def test_activate_order_item_and_broadcast() -> None:
    client = create_test_client()
    items = client.get("/api/order-items").json()
    target_item = items[1]

    with client.websocket_connect("/ws/display") as websocket:
        initial_event = websocket.receive_json()
        assert initial_event["type"] == "display.updated"
        assert initial_event["payload"]["activeItemId"] is None

        response = client.post(f"/api/order-items/{target_item['id']}/activate")
        event = websocket.receive_json()

    assert response.status_code == 200
    assert event["type"] == "display.updated"
    assert event["payload"]["activeItemId"] == target_item["id"]
