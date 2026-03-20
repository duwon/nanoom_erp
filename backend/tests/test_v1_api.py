from __future__ import annotations

from urllib.parse import parse_qs, urlparse

from app.config import get_settings
from app.modules.udms.repository import InMemoryUdmsRepository
from app.modules.users.repository import InMemoryUserRepository
from app.modules.users.schemas import SocialProvider
from app.services.oauth_service import OAuthError, OAuthIdentity
from tests.test_app import create_test_client


class FakeOAuthService:
    def __init__(self) -> None:
        self.identities = {
            "new-member": OAuthIdentity(
                provider=SocialProvider.google,
                provider_user_id="oauth-new-member",
                email="member@example.com",
                name="새 성도",
            ),
            "master-login": OAuthIdentity(
                provider=SocialProvider.google,
                provider_user_id="dev-master",
                email="admin@localhost",
                name="개발 관리자",
            ),
        }

    def is_configured(self, provider: SocialProvider) -> bool:
        return True

    def is_dev_seed_available(self, provider: SocialProvider) -> bool:
        return False

    def build_authorization_url(self, provider: SocialProvider, redirect_uri: str, state: str) -> str:
        return f"https://oauth.example/{provider.value}?redirect_uri={redirect_uri}&state={state}"

    async def exchange_code(self, provider: SocialProvider, code: str, redirect_uri: str) -> OAuthIdentity:
        if code == "missing-email":
            raise OAuthError("Google account email is required")
        identity = self.identities.get(code)
        if identity is None or identity.provider != provider:
            raise OAuthError("Unknown OAuth test code")
        return identity


def issue_oauth_login(client, code: str, provider: str = "google", next_path: str = "/"):
    start_response = client.get(
        f"/api/v1/auth/oauth/{provider}/start",
        params={"next": next_path},
        follow_redirects=False,
    )
    assert start_response.status_code == 307

    state = parse_qs(urlparse(start_response.headers["location"]).query)["state"][0]
    callback_response = client.get(
        f"/api/v1/auth/oauth/{provider}/callback",
        params={"code": code, "state": state},
        follow_redirects=False,
    )
    assert callback_response.status_code == 307
    return callback_response


def frontend_url() -> str:
    return get_settings().resolved_frontend_app_url


def activate_workspace_user(member_client, admin_client, *, role: str = "editor") -> str:
    issue_oauth_login(member_client, "new-member")
    member_client.put(
        "/api/v1/users/me/profile",
        json={"name": "홍길동", "position": "성도", "department": "새가족부"},
    )
    member_id = member_client.get("/api/v1/auth/me").json()["id"]

    issue_oauth_login(admin_client, "master-login")
    admin_client.put(
        f"/api/v1/admin/users/{member_id}",
        json={"role": role, "status": "active"},
    )
    issue_oauth_login(member_client, "new-member")
    return member_id


def test_social_login_creates_pending_member_and_reuses_same_account() -> None:
    repository = InMemoryUserRepository.bootstrap()
    client = create_test_client(user_repository=repository, oauth_service=FakeOAuthService())

    first_callback = issue_oauth_login(client, "new-member")
    assert first_callback.headers["location"] == f"{frontend_url()}/onboarding"

    me_response = client.get("/api/v1/auth/me")
    assert me_response.status_code == 200
    payload = me_response.json()
    assert payload["email"] == "member@example.com"
    assert payload["role"] == "member"
    assert payload["status"] == "pending"

    user_count = len(repository.users)
    user_id = payload["id"]

    second_callback = issue_oauth_login(client, "new-member")
    assert second_callback.headers["location"] == f"{frontend_url()}/onboarding"
    assert len(repository.users) == user_count

    second_me = client.get("/api/v1/auth/me")
    assert second_me.status_code == 200
    assert second_me.json()["id"] == user_id


def test_oauth_login_without_email_redirects_to_login_error() -> None:
    client = create_test_client(
        user_repository=InMemoryUserRepository.bootstrap(),
        oauth_service=FakeOAuthService(),
    )

    callback_response = issue_oauth_login(client, "missing-email")
    assert callback_response.headers["location"].startswith(f"{frontend_url()}/login?error=")

    me_response = client.get("/api/v1/auth/me")
    assert me_response.status_code == 401


def test_pending_user_can_update_profile_but_cannot_access_workspace() -> None:
    repository = InMemoryUserRepository.bootstrap()
    client = create_test_client(user_repository=repository, oauth_service=FakeOAuthService())

    issue_oauth_login(client, "new-member")

    boards_response = client.get("/api/v1/udms/boards")
    assert boards_response.status_code == 403

    profile_response = client.put(
        "/api/v1/users/me/profile",
        json={"name": "홍길동", "position": "성도", "department": "새가족부"},
    )
    assert profile_response.status_code == 200
    assert profile_response.json()["name"] == "홍길동"
    assert profile_response.json()["status"] == "pending"


def test_master_can_activate_user_and_active_user_can_access_udms() -> None:
    repository = InMemoryUserRepository.bootstrap()
    oauth_service = FakeOAuthService()
    member_client = create_test_client(user_repository=repository, oauth_service=oauth_service)
    admin_client = create_test_client(user_repository=repository, oauth_service=oauth_service)

    issue_oauth_login(member_client, "new-member")
    member_client.put(
        "/api/v1/users/me/profile",
        json={"name": "홍길동", "position": "성도", "department": "새가족부"},
    )
    member_id = member_client.get("/api/v1/auth/me").json()["id"]

    admin_callback = issue_oauth_login(admin_client, "master-login")
    assert admin_callback.headers["location"] == f"{frontend_url()}/admin"

    approve_response = admin_client.put(
        f"/api/v1/admin/users/{member_id}",
        json={"role": "editor", "status": "active"},
    )
    assert approve_response.status_code == 200

    relogin_callback = issue_oauth_login(member_client, "new-member")
    assert relogin_callback.headers["location"] == f"{frontend_url()}/dashboard"

    boards_response = member_client.get("/api/v1/udms/boards")
    assert boards_response.status_code == 200


def test_blocked_user_keeps_me_access_but_loses_workspace_access() -> None:
    repository = InMemoryUserRepository.bootstrap()
    oauth_service = FakeOAuthService()
    member_client = create_test_client(user_repository=repository, oauth_service=oauth_service)
    admin_client = create_test_client(user_repository=repository, oauth_service=oauth_service)

    issue_oauth_login(member_client, "new-member")
    member_client.put(
        "/api/v1/users/me/profile",
        json={"name": "홍길동", "position": "성도", "department": "새가족부"},
    )
    member_id = member_client.get("/api/v1/auth/me").json()["id"]

    issue_oauth_login(admin_client, "master-login")
    block_response = admin_client.put(
        f"/api/v1/admin/users/{member_id}",
        json={"status": "blocked"},
    )
    assert block_response.status_code == 200

    me_response = member_client.get("/api/v1/auth/me")
    assert me_response.status_code == 200
    assert me_response.json()["status"] == "blocked"

    boards_response = member_client.get("/api/v1/udms/boards")
    assert boards_response.status_code == 403


def test_editor_can_create_publish_edit_and_lock_v2_document() -> None:
    repository = InMemoryUserRepository.bootstrap()
    oauth_service = FakeOAuthService()
    editor_client = create_test_client(user_repository=repository, oauth_service=oauth_service)
    admin_client = create_test_client(user_repository=repository, oauth_service=oauth_service)

    issue_oauth_login(editor_client, "new-member")
    editor_client.put(
        "/api/v1/users/me/profile",
        json={"name": "홍길동", "position": "성도", "department": "새가족부"},
    )
    member_id = editor_client.get("/api/v1/auth/me").json()["id"]

    issue_oauth_login(admin_client, "master-login")
    admin_client.put(
        f"/api/v1/admin/users/{member_id}",
        json={"role": "editor", "status": "active"},
    )
    issue_oauth_login(editor_client, "new-member")

    created = editor_client.post(
        "/api/v1/udms/docs",
        json={
            "title": "주보 초안",
            "category": "BoardPost",
            "tags": ["notice", "weekly"],
            "targetType": "Board",
            "targetId": "board-notice",
            "body": "<p>첫 번째 초안</p>",
        },
    )
    assert created.status_code == 200
    created_payload = created.json()
    assert created_payload["state"]["status"] == "draft"
    assert created_payload["currentRevision"]["version"] == 1

    secured = editor_client.put(
        f"/api/v1/udms/docs/{created_payload['id']}/security",
        json={
            "acl": [
                {
                    "subjectType": "department",
                    "subjectId": "새가족부",
                    "actions": ["edit"],
                    "effect": "allow",
                }
            ]
        },
    )
    assert secured.status_code == 200
    assert secured.json()["security"]["acl"][0]["subjectId"] == "새가족부"

    published = editor_client.post(f"/api/v1/udms/docs/{created_payload['id']}/publish")
    assert published.status_code == 200
    assert published.json()["state"]["status"] == "published"
    assert published.json()["publishedRevision"]["version"] == 1

    working = editor_client.post(f"/api/v1/udms/docs/{created_payload['id']}/working-copy")
    assert working.status_code == 200
    assert working.json()["workingRevision"]["version"] == 2

    updated = editor_client.patch(
        f"/api/v1/udms/docs/{created_payload['id']}",
        json={"title": "주보 수정안", "body": "<p>두 번째 초안</p>", "changeLog": "본문 수정"},
    )
    assert updated.status_code == 200
    updated_payload = updated.json()
    assert updated_payload["currentRevision"]["version"] == 3
    assert updated_payload["publishedRevision"]["version"] == 1

    revisions = editor_client.get(f"/api/v1/udms/docs/{created_payload['id']}/revisions")
    assert revisions.status_code == 200
    assert [item["version"] for item in revisions.json()] == [3, 2, 1]

    locked = editor_client.post(
        "/api/v1/udms/hooks/approval-completed",
        json={"documentId": created_payload["id"]},
    )
    assert locked.status_code == 200
    assert locked.json()[0]["state"]["status"] == "locked"


def test_active_member_can_read_documents_but_cannot_create_without_target_create_permission() -> None:
    repository = InMemoryUserRepository.bootstrap()
    oauth_service = FakeOAuthService()
    member_client = create_test_client(user_repository=repository, oauth_service=oauth_service)
    admin_client = create_test_client(user_repository=repository, oauth_service=oauth_service)

    issue_oauth_login(member_client, "new-member")
    member_client.put(
        "/api/v1/users/me/profile",
        json={"name": "홍길동", "position": "성도", "department": "새가족부"},
    )
    member_id = member_client.get("/api/v1/auth/me").json()["id"]

    issue_oauth_login(admin_client, "master-login")
    admin_client.put(
        f"/api/v1/admin/users/{member_id}",
        json={"role": "member", "status": "active"},
    )
    issue_oauth_login(member_client, "new-member")

    boards_response = member_client.get("/api/v1/udms/boards")
    assert boards_response.status_code == 200
    assert any(board["id"] == "board-notice" for board in boards_response.json())

    docs_response = member_client.get("/api/v1/udms/docs")
    assert docs_response.status_code == 200
    assert any(doc["id"] == "doc-worship-guide" for doc in docs_response.json())

    create_response = member_client.post(
        "/api/v1/udms/docs",
        json={
            "title": "멤버 작성",
            "targetType": "Board",
            "targetId": "board-notice",
            "body": "<p>권한 없음</p>",
        },
    )
    assert create_response.status_code == 409


def test_target_catalog_returns_enabled_and_disabled_targets() -> None:
    repository = InMemoryUserRepository.bootstrap()
    oauth_service = FakeOAuthService()
    member_client = create_test_client(user_repository=repository, oauth_service=oauth_service)
    admin_client = create_test_client(user_repository=repository, oauth_service=oauth_service)

    activate_workspace_user(member_client, admin_client, role="member")

    response = member_client.get("/api/v1/udms/target-types")
    assert response.status_code == 200

    payload = {item["targetType"]: item for item in response.json()}
    assert payload["Board"]["isEnabled"] is True
    assert payload["Board"]["requiresExistingParent"] is True
    assert payload["Approval"]["isEnabled"] is False
    assert payload["WorshipOrder"]["isEnabled"] is False
    assert payload["Board"]["namespace"] == "board"


def test_disabled_and_unregistered_target_types_are_rejected_for_writes_but_allowed_for_reads_and_hooks() -> None:
    repository = InMemoryUserRepository.bootstrap()
    oauth_service = FakeOAuthService()
    editor_client = create_test_client(user_repository=repository, oauth_service=oauth_service)
    admin_client = create_test_client(user_repository=repository, oauth_service=oauth_service)

    activate_workspace_user(editor_client, admin_client, role="editor")

    disabled_create = editor_client.post(
        "/api/v1/udms/docs",
        json={
            "title": "결재 초안",
            "targetType": "Approval",
            "targetId": "approval-general",
            "body": "<p>disabled</p>",
        },
    )
    assert disabled_create.status_code == 409
    assert "disabled" in disabled_create.json()["detail"]

    unregistered_create = editor_client.post(
        "/api/v1/udms/docs",
        json={
            "title": "알 수 없는 타겟",
            "targetType": "UnknownTarget",
            "targetId": "unknown-1",
            "body": "<p>missing</p>",
        },
    )
    assert unregistered_create.status_code == 409
    assert "not registered" in unregistered_create.json()["detail"]

    disabled_policy = admin_client.put(
        "/api/v1/udms/policies/Approval/approval-general",
        json=[],
    )
    assert disabled_policy.status_code == 409
    assert "disabled" in disabled_policy.json()["detail"]

    unregistered_policy = admin_client.put(
        "/api/v1/udms/policies/UnknownTarget/unknown-1",
        json=[],
    )
    assert unregistered_policy.status_code == 409
    assert "not registered" in unregistered_policy.json()["detail"]

    disabled_read = editor_client.get("/api/v1/udms/docs", params={"targetType": "Approval"})
    assert disabled_read.status_code == 200
    assert disabled_read.json() == []

    disabled_hook = admin_client.post(
        "/api/v1/udms/hooks/parent-deleted",
        json={"targetType": "Approval", "targetId": "approval-general", "policy": "orphan"},
    )
    assert disabled_hook.status_code == 200
    assert disabled_hook.json() == []


def test_legacy_v1_documents_are_migrated_to_v2_root_revision_model() -> None:
    client = create_test_client(udms_repository=InMemoryUdmsRepository.bootstrap_legacy())

    docs_response = client.get("/api/v1/udms/docs")
    assert docs_response.status_code == 401

    repository = InMemoryUserRepository.bootstrap()
    oauth_service = FakeOAuthService()
    member_client = create_test_client(
        user_repository=repository,
        udms_repository=InMemoryUdmsRepository.bootstrap_legacy(),
        oauth_service=oauth_service,
    )
    admin_client = create_test_client(
        user_repository=repository,
        udms_repository=InMemoryUdmsRepository.bootstrap_legacy(),
        oauth_service=oauth_service,
    )

    issue_oauth_login(member_client, "new-member")
    member_client.put(
        "/api/v1/users/me/profile",
        json={"name": "홍길동", "position": "성도", "department": "새가족부"},
    )
    member_id = member_client.get("/api/v1/auth/me").json()["id"]

    issue_oauth_login(admin_client, "master-login")
    admin_client.put(
        f"/api/v1/admin/users/{member_id}",
        json={"role": "editor", "status": "active"},
    )
    issue_oauth_login(member_client, "new-member")

    documents = member_client.get("/api/v1/udms/docs")
    assert documents.status_code == 200
    payload = next(item for item in documents.json() if item["id"] == "doc-legacy")
    assert payload["publishedRevision"]["version"] == 1
    assert payload["workingRevision"]["version"] == 2
    assert payload["securitySummary"]["aclCount"] == 1

    revisions = member_client.get("/api/v1/udms/docs/doc-legacy/revisions")
    assert revisions.status_code == 200
    assert [item["version"] for item in revisions.json()] == [2, 1]
