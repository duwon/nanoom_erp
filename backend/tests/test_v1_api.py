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
    assert relogin_callback.headers["location"] == f"{frontend_url()}/"

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
