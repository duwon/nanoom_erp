from __future__ import annotations

from urllib.parse import parse_qs, urlparse

from app.config import get_settings
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

    async def exchange_code(
        self,
        provider: SocialProvider,
        code: str,
        redirect_uri: str,
    ) -> OAuthIdentity:
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
    assert approve_response.json()["status"] == "active"
    assert approve_response.json()["role"] == "editor"

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
    assert block_response.json()["status"] == "blocked"

    me_response = member_client.get("/api/v1/auth/me")
    assert me_response.status_code == 200
    assert me_response.json()["status"] == "blocked"

    boards_response = member_client.get("/api/v1/udms/boards")
    assert boards_response.status_code == 403


def test_editor_can_create_publish_and_version_document_with_share_inheritance() -> None:
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
        "/api/v1/udms/documents",
        json={
            "boardId": "board-notice",
            "title": "주보 초안",
            "content": "<p>첫 번째 초안</p>",
            "approvalTemplateId": "approval-general",
        },
    )
    assert created.status_code == 200
    created_payload = created.json()
    assert created_payload["status"] == "draft"
    assert created_payload["originDocId"] == created_payload["id"]
    assert created_payload["versionNumber"] == 1

    share_response = editor_client.put(
        f"/api/v1/udms/documents/{created_payload['id']}/shares",
        json=[{"targetType": "department", "targetId": "새가족부", "permission": "read"}],
    )
    assert share_response.status_code == 200
    assert share_response.json()[0]["targetId"] == "새가족부"

    published = editor_client.post(f"/api/v1/udms/documents/{created_payload['id']}/publish", json={})
    assert published.status_code == 200
    assert published.json()["status"] == "published"

    next_version = editor_client.post(f"/api/v1/udms/documents/{created_payload['id']}/versions", json={})
    assert next_version.status_code == 200
    next_payload = next_version.json()
    assert next_payload["status"] == "draft"
    assert next_payload["prevDocId"] == created_payload["id"]
    assert next_payload["originDocId"] == created_payload["originDocId"]
    assert next_payload["versionNumber"] == 2
    assert next_payload["shares"][0]["targetId"] == "새가족부"

    versions = editor_client.get(f"/api/v1/udms/documents/{next_payload['id']}/versions")
    assert versions.status_code == 200
    assert [item["versionNumber"] for item in versions.json()] == [2, 1]


def test_active_member_can_read_documents_but_cannot_create_without_board_create_permission() -> None:
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

    create_response = member_client.post(
        "/api/v1/udms/documents",
        json={"boardId": "board-notice", "title": "멤버 작성", "content": "<p>권한 없음</p>"},
    )
    assert create_response.status_code == 409
