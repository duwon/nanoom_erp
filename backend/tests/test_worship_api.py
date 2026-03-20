from __future__ import annotations

import asyncio
from datetime import datetime, timedelta

from app.core.store import iso_now
from app.modules.users.repository import InMemoryUserRepository
from tests.test_app import create_test_client
from tests.test_v1_api import FakeOAuthService, activate_workspace_user, issue_oauth_login

SUNDAY_ANCHOR_DATE = "2026-03-22"


def create_active_workspace_client(role: str = "editor"):
    repository = InMemoryUserRepository.bootstrap()
    oauth_service = FakeOAuthService()
    member_client = create_test_client(user_repository=repository, oauth_service=oauth_service)
    admin_client = create_test_client(user_repository=repository, oauth_service=oauth_service)
    activate_workspace_user(member_client, admin_client, role=role)
    return member_client


def create_master_client():
    repository = InMemoryUserRepository.bootstrap()
    oauth_service = FakeOAuthService()
    client = create_test_client(user_repository=repository, oauth_service=oauth_service)
    issue_oauth_login(client, "master-login")
    return client


def get_calendar_payload(client, *, anchor_date: str = SUNDAY_ANCHOR_DATE, days: int = 3) -> dict:
    response = client.get(
        "/api/v1/worship/calendar",
        params={"anchorDate": anchor_date, "days": days},
    )
    assert response.status_code == 200
    return response.json()


def find_service(payload: dict, *, target_date: str, service_kind: str) -> dict:
    for day in payload["days"]:
        if day["date"] != target_date:
            continue
        for service in day["services"]:
            if service["serviceKind"] == service_kind:
                return service
    raise AssertionError(f"service '{service_kind}' not found on {target_date}")


def get_service_detail(client, service_id: str) -> dict:
    response = client.get(f"/api/v1/worship/services/{service_id}")
    assert response.status_code == 200
    return response.json()


def update_task_guest_access(client, service_id: str, task_id: str, **changes: str | None) -> None:
    repository = client.app.state.service.repository
    service = asyncio.run(repository.get_service(service_id))
    task = next(item for item in service["tasks"] if item["id"] == task_id)
    task["guest_access"].update(changes)
    asyncio.run(repository.save_service(service))


def test_worship_calendar_materializes_seeded_services() -> None:
    client = create_active_workspace_client()

    payload = get_calendar_payload(client)
    sunday_services = {
        item["serviceKind"]
        for item in next(day for day in payload["days"] if day["date"] == SUNDAY_ANCHOR_DATE)["services"]
    }

    assert payload["defaultServiceId"]
    assert {"dawn", "sunday1", "sunday2", "sundayPm"}.issubset(sunday_services)


def test_worship_calendar_accepts_42_day_workspace_window() -> None:
    client = create_active_workspace_client()

    payload = get_calendar_payload(client, days=42)

    assert len(payload["days"]) == 42


def test_worship_calendar_auto_materializes_only_next_10_days() -> None:
    client = create_active_workspace_client()

    payload = get_calendar_payload(client, anchor_date="2026-03-20", days=42)

    assert next(day for day in payload["days"] if day["date"] == "2026-03-30")["services"]
    assert next(day for day in payload["days"] if day["date"] == "2026-04-05")["services"] == []


def test_editor_can_manually_create_worship_service_for_selected_date() -> None:
    client = create_active_workspace_client()

    before = get_calendar_payload(client, anchor_date="2026-04-05", days=3)
    selected_day = next(day for day in before["days"] if day["date"] == "2026-04-05")
    assert selected_day["services"] == []
    assert any(template["serviceKind"] == "sunday1" for template in selected_day["availableTemplates"])

    create_response = client.post(
        "/api/v1/worship/services",
        json={"targetDate": "2026-04-05", "templateId": "wtemplate-sunday1"},
    )
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["date"] == "2026-04-05"
    assert created["serviceKind"] == "sunday1"

    after = get_calendar_payload(client, anchor_date="2026-04-05", days=3)
    created_service = find_service(after, target_date="2026-04-05", service_kind="sunday1")
    assert created_service["id"] == created["id"]
    updated_day = next(day for day in after["days"] if day["date"] == "2026-04-05")
    assert all(template["serviceKind"] != "sunday1" for template in updated_day["availableTemplates"])


def test_worship_service_update_detects_version_conflict() -> None:
    client = create_active_workspace_client()
    service = find_service(get_calendar_payload(client), target_date=SUNDAY_ANCHOR_DATE, service_kind="sunday1")

    original = get_service_detail(client, service["id"])
    update_response = client.patch(
        f"/api/v1/worship/services/{service['id']}",
        json={
            "version": original["version"],
            "summary": "주일 1부 운영 메모 업데이트",
            "serviceName": "주일 1부 예배 업데이트",
        },
    )

    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["version"] == original["version"] + 1
    assert updated["summary"] == "주일 1부 운영 메모 업데이트"
    assert updated["serviceName"] == "주일 1부 예배 업데이트"

    stale_response = client.patch(
        f"/api/v1/worship/services/{service['id']}",
        json={"version": original["version"], "summary": "stale"},
    )
    assert stale_response.status_code == 409


def test_worship_sections_reorder_and_parse_lyrics() -> None:
    client = create_active_workspace_client()
    service = find_service(get_calendar_payload(client), target_date=SUNDAY_ANCHOR_DATE, service_kind="sunday1")
    detail = get_service_detail(client, service["id"])

    parse_response = client.post(
        f"/api/v1/worship/services/{service['id']}/sections/opening-song/lyrics:parse",
        json={
            "lyrics": "Verse 1\n주를 찬양합니다\n\nChorus\n영광 돌립니다",
            "templateKey": "lyrics-16x9",
        },
    )
    assert parse_response.status_code == 200
    parsed = parse_response.json()
    assert [slide["label"] for slide in parsed["slides"]] == ["Verse 1", "Chorus"]

    reorder_response = client.post(
        f"/api/v1/worship/services/{service['id']}/sections/reorder",
        json={
            "version": detail["version"],
            "sections": [
                {"sectionId": "opening-song", "order": 2},
                {"sectionId": "hymn", "order": 1},
            ],
        },
    )
    assert reorder_response.status_code == 200
    reordered = reorder_response.json()
    order_map = {section["id"]: section["order"] for section in reordered["sections"]}
    assert order_map["opening-song"] == 2
    assert order_map["hymn"] == 1


def test_guest_input_link_filters_values_and_updates_sections() -> None:
    client = create_active_workspace_client()
    service = find_service(get_calendar_payload(client), target_date=SUNDAY_ANCHOR_DATE, service_kind="sunday1")

    link_response = client.post(
        f"/api/v1/worship/services/{service['id']}/tasks/task-opening-song/guest-link"
    )
    assert link_response.status_code == 200
    link_payload = link_response.json()
    assert link_payload["inputUrl"].endswith(link_payload["token"])

    guest_view = client.get(f"/api/v1/worship/input/{link_payload['token']}")
    assert guest_view.status_code == 200
    assert {field["key"] for field in guest_view.json()["requiredFields"]} == {"songTitle", "lyrics"}

    submit_response = client.put(
        f"/api/v1/worship/input/{link_payload['token']}",
        json={
            "markComplete": True,
            "values": {
                "songTitle": "은혜",
                "lyrics": "Verse 1\n은혜가 넘칩니다\n\nChorus\n주님을 찬양합니다",
                "ignored": "nope",
            }
        },
    )
    assert submit_response.status_code == 200
    submitted = submit_response.json()
    assert set(submitted["values"]) == {"songTitle", "lyrics"}

    updated = get_service_detail(client, service["id"])
    opening_song = next(section for section in updated["sections"] if section["id"] == "opening-song")
    praise_task = next(task for task in updated["tasks"] if task["id"] == "task-opening-song")

    assert opening_song["title"] == "은혜"
    assert opening_song["status"] == "review"
    assert updated["status"] == "progress"
    assert len(opening_song["slides"]) == 2
    assert praise_task["status"] == "review"


def test_guest_input_rejects_expired_and_revoked_links() -> None:
    client = create_active_workspace_client()
    service = find_service(get_calendar_payload(client), target_date=SUNDAY_ANCHOR_DATE, service_kind="sunday1")

    expired_link = client.post(
        f"/api/v1/worship/services/{service['id']}/tasks/task-opening-song/guest-link"
    ).json()
    past_time = (datetime.now(client.app.state.service.timezone) - timedelta(minutes=5)).isoformat()
    update_task_guest_access(
        client,
        service["id"],
        "task-opening-song",
        expires_at=past_time,
    )
    expired_response = client.get(f"/api/v1/worship/input/{expired_link['token']}")
    assert expired_response.status_code == 409
    assert "expired" in expired_response.json()["detail"]

    revoked_link = client.post(
        f"/api/v1/worship/services/{service['id']}/tasks/task-opening-song/guest-link"
    ).json()
    update_task_guest_access(
        client,
        service["id"],
        "task-opening-song",
        revoked_at=iso_now(),
    )
    revoked_response = client.get(f"/api/v1/worship/input/{revoked_link['token']}")
    assert revoked_response.status_code == 409
    assert "revoked" in revoked_response.json()["detail"]


def test_scripture_review_and_presentation_activation_broadcast() -> None:
    client = create_active_workspace_client()
    service = find_service(get_calendar_payload(client), target_date=SUNDAY_ANCHOR_DATE, service_kind="sunday1")
    detail = get_service_detail(client, service["id"])

    scripture_response = client.get(
        "/api/v1/worship/lookups/scripture",
        params={
            "book": "요한복음",
            "chapter": 3,
            "verseStart": 16,
            "verseEnd": 17,
            "translation": "KRV",
        },
    )
    assert scripture_response.status_code == 200
    scripture = scripture_response.json()
    assert scripture["reference"] == "요한복음 3:16-17"
    assert len(scripture["slides"]) == 2

    update_response = client.patch(
        f"/api/v1/worship/services/{service['id']}/sections/scripture",
        json={
            "version": detail["version"],
            "detail": scripture["reference"],
            "slides": scripture["slides"],
            "status": "review",
        },
    )
    assert update_response.status_code == 200

    review_response = client.get(f"/api/v1/worship/services/{service['id']}/review")
    assert review_response.status_code == 200
    review = review_response.json()
    assert review["items"]
    assert all(item["status"] in {"waiting", "progress", "review"} for item in review["items"])

    with client.websocket_connect("/ws/display") as websocket:
        initial_event = websocket.receive_json()
        assert initial_event["type"] == "display.updated"

        activate_response = client.post(
            f"/api/v1/worship/services/{service['id']}/presentation/activate",
            json={"selectedSectionIds": ["scripture"]},
        )
        event = websocket.receive_json()

    assert activate_response.status_code == 200
    activated = activate_response.json()
    assert activated["activeSectionId"] == "scripture"
    assert event["payload"]["activeItemId"] == "scripture"

    display_response = client.get("/api/display-state")
    assert display_response.status_code == 200
    assert display_response.json()["activeItemId"] == "scripture"
    assert "하나님이 세상을 이처럼 사랑하사" in display_response.json()["content"]


def test_member_can_read_worship_but_cannot_edit() -> None:
    client = create_active_workspace_client(role="member")
    calendar = get_calendar_payload(client)
    service_id = calendar["defaultServiceId"]
    service = get_service_detail(client, service_id)

    response = client.patch(
        f"/api/v1/worship/services/{service_id}",
        json={"version": service["version"], "summary": "member edit"},
    )
    assert response.status_code == 409
    assert "Editing requires" in response.json()["detail"]


def test_master_can_list_create_and_update_worship_templates() -> None:
    client = create_master_client()

    list_response = client.get("/api/v1/admin/worship-templates")
    assert list_response.status_code == 200
    assert len(list_response.json()) >= 6

    create_response = client.post(
        "/api/v1/admin/worship-templates",
        json={
            "serviceKind": "retreat",
            "displayName": "수련회 예배",
            "startTime": "16:00",
            "generationRule": "daily",
            "defaultSections": [],
            "taskPresets": [],
            "templatePresets": [],
            "isActive": False,
        },
    )
    assert create_response.status_code == 200
    created = create_response.json()
    assert created["serviceKind"] == "retreat"

    update_response = client.put(
        f"/api/v1/admin/worship-templates/{created['id']}",
        json={
            "serviceKind": "retreat",
            "displayName": "수련회 집회",
            "startTime": "16:00",
            "generationRule": "daily",
            "defaultSections": [],
            "taskPresets": [],
            "templatePresets": [],
            "isActive": True,
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["displayName"] == "수련회 집회"
    assert update_response.json()["isActive"] is True


def test_deleting_template_does_not_remove_existing_service() -> None:
    client = create_master_client()

    create_response = client.post(
        "/api/v1/admin/worship-templates",
        json={
            "serviceKind": "retreat-temp",
            "displayName": "??湲? ?덈같",
            "startTime": "16:00",
            "generationRule": "daily",
            "defaultSections": [],
            "taskPresets": [],
            "templatePresets": [],
            "isActive": True,
        },
    )
    assert create_response.status_code == 200
    created = create_response.json()

    materialize_response = client.post(
        "/api/v1/worship/services",
        json={"targetDate": "2026-03-25", "templateId": created["id"]},
    )
    assert materialize_response.status_code == 201
    service = materialize_response.json()

    delete_response = client.delete(f"/api/v1/admin/worship-templates/{created['id']}")
    assert delete_response.status_code == 204

    deleted_lookup = client.get("/api/v1/admin/worship-templates")
    assert deleted_lookup.status_code == 200
    assert all(item["id"] != created["id"] for item in deleted_lookup.json())

    detail_response = client.get(f"/api/v1/worship/services/{service['id']}")
    assert detail_response.status_code == 200
    assert detail_response.json()["templateId"] == created["id"]

    missing_delete = client.delete(f"/api/v1/admin/worship-templates/{created['id']}")
    assert missing_delete.status_code == 404


def test_worship_order_target_requires_existing_parent() -> None:
    client = create_master_client()
    service = find_service(get_calendar_payload(client), target_date=SUNDAY_ANCHOR_DATE, service_kind="sunday1")

    create_response = client.post(
        "/api/v1/udms/docs",
        json={
            "title": "예배 운영 문서",
            "category": "WorshipNote",
            "tags": ["worship"],
            "targetType": "WorshipOrder",
            "targetId": service["id"],
            "body": "<p>운영 노트</p>",
        },
    )
    assert create_response.status_code == 200
    assert create_response.json()["link"]["deepLink"] == f"/worship?serviceId={service['id']}"

    missing_parent = client.post(
        "/api/v1/udms/docs",
        json={
            "title": "예배 운영 문서",
            "category": "WorshipNote",
            "tags": ["worship"],
            "targetType": "WorshipOrder",
            "targetId": "svc-missing",
            "body": "<p>운영 노트</p>",
        },
    )
    assert missing_parent.status_code == 404


def test_worship_service_materializes_udms_order_document_only_visible_in_generic_list() -> None:
    client = create_active_workspace_client()
    service = find_service(get_calendar_payload(client), target_date=SUNDAY_ANCHOR_DATE, service_kind="sunday1")

    order_docs_response = client.get(
        "/api/v1/udms/docs",
        params={"targetType": "WorshipOrder", "targetId": service["id"]},
    )
    assert order_docs_response.status_code == 200
    order_docs = order_docs_response.json()
    assert len(order_docs) == 1
    assert order_docs[0]["link"]["targetType"] == "WorshipOrder"
    assert order_docs[0]["moduleData"]["service_meta"]["id"] == service["id"]

    hidden_docs_response = client.get(
        "/api/v1/udms/docs",
        params={"targetType": "WorshipContent", "targetId": service["id"]},
    )
    assert hidden_docs_response.status_code == 200
    assert hidden_docs_response.json() == []
