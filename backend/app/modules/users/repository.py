from __future__ import annotations

from copy import deepcopy
from typing import Protocol

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, ReturnDocument

from app.core.store import iso_now, new_id
from app.modules.users.schemas import SocialProvider, UserRole, UserStatus
from app.services.oauth_service import OAuthIdentity


class UserRepositoryError(Exception):
    pass


class UserNotFoundError(UserRepositoryError):
    pass


class UserRepository(Protocol):
    async def ensure_indexes(self) -> None: ...

    async def seed_master_user(
        self,
        provider: SocialProvider,
        provider_user_id: str,
        email: str,
        name: str,
    ) -> dict: ...

    async def get_user(self, user_id: str) -> dict: ...

    async def list_users(self) -> list[dict]: ...

    async def login_with_oauth(self, identity: OAuthIdentity) -> dict: ...

    async def update_profile(self, user_id: str, payload: dict) -> dict: ...

    async def admin_update_user(self, user_id: str, payload: dict, actor_id: str) -> dict: ...


def _status_rank(status: str) -> int:
    return {
        UserStatus.pending.value: 0,
        UserStatus.active.value: 1,
        UserStatus.blocked.value: 2,
    }.get(status, 99)


class MongoUserRepository:
    def __init__(self, database: AsyncIOMotorDatabase):
        self.collection = database["users"]

    async def ensure_indexes(self) -> None:
        await self.collection.create_index([("id", ASCENDING)], unique=True)
        await self.collection.create_index(
            [("social_provider", ASCENDING), ("provider_user_id", ASCENDING)],
            unique=True,
        )
        await self.collection.create_index([("email", ASCENDING)])
        await self.collection.create_index([("status", ASCENDING)])
        await self.collection.create_index([("role", ASCENDING)])

    async def seed_master_user(
        self,
        provider: SocialProvider,
        provider_user_id: str,
        email: str,
        name: str,
    ) -> dict:
        now = iso_now()
        existing = await self.collection.find_one(
            {"social_provider": provider.value, "provider_user_id": provider_user_id},
            {"_id": False},
        )
        if existing is None:
            user = {
                "id": new_id("user"),
                "email": email,
                "social_provider": provider.value,
                "provider_user_id": provider_user_id,
                "role": UserRole.master.value,
                "status": UserStatus.active.value,
                "name": name,
                "position": "관리자",
                "department": "시스템",
                "approved_at": now,
                "approved_by": None,
                "last_login_at": now,
                "created_at": now,
                "updated_at": now,
            }
            await self.collection.insert_one(deepcopy(user))
            return user

        updated = await self.collection.find_one_and_update(
            {"id": existing["id"]},
            {
                "$set": {
                    "email": email,
                    "role": UserRole.master.value,
                    "status": UserStatus.active.value,
                    "name": existing.get("name") or name,
                    "position": existing.get("position") or "관리자",
                    "department": existing.get("department") or "시스템",
                    "approved_at": existing.get("approved_at") or now,
                    "updated_at": now,
                }
            },
            projection={"_id": False},
            return_document=ReturnDocument.AFTER,
        )
        return updated

    async def get_user(self, user_id: str) -> dict:
        user = await self.collection.find_one({"id": user_id}, {"_id": False})
        if user is None:
            raise UserNotFoundError(f"User '{user_id}' was not found.")
        return user

    async def list_users(self) -> list[dict]:
        users = await self.collection.find({}, {"_id": False}).to_list(None)
        return sorted(users, key=lambda row: (_status_rank(row["status"]), row["created_at"]))

    async def login_with_oauth(self, identity: OAuthIdentity) -> dict:
        now = iso_now()
        existing = await self.collection.find_one(
            {
                "social_provider": identity.provider.value,
                "provider_user_id": identity.provider_user_id,
            },
            {"_id": False},
        )

        if existing is None:
            user = {
                "id": new_id("user"),
                "email": identity.email,
                "social_provider": identity.provider.value,
                "provider_user_id": identity.provider_user_id,
                "role": UserRole.member.value,
                "status": UserStatus.pending.value,
                "name": identity.name,
                "position": None,
                "department": None,
                "approved_at": None,
                "approved_by": None,
                "last_login_at": now,
                "created_at": now,
                "updated_at": now,
            }
            await self.collection.insert_one(deepcopy(user))
            return user

        updates: dict[str, str | None] = {
            "email": identity.email,
            "last_login_at": now,
            "updated_at": now,
        }
        if not existing.get("name") and identity.name:
            updates["name"] = identity.name
        updated = await self.collection.find_one_and_update(
            {"id": existing["id"]},
            {"$set": updates},
            projection={"_id": False},
            return_document=ReturnDocument.AFTER,
        )
        return updated

    async def update_profile(self, user_id: str, payload: dict) -> dict:
        updated = await self.collection.find_one_and_update(
            {"id": user_id},
            {
                "$set": {
                    "name": payload["name"],
                    "position": payload["position"],
                    "department": payload["department"],
                    "updated_at": iso_now(),
                }
            },
            projection={"_id": False},
            return_document=ReturnDocument.AFTER,
        )
        if updated is None:
            raise UserNotFoundError(f"User '{user_id}' was not found.")
        return updated

    async def admin_update_user(self, user_id: str, payload: dict, actor_id: str) -> dict:
        existing = await self.get_user(user_id)
        updates: dict[str, str | None] = {"updated_at": iso_now()}
        if "role" in payload and payload["role"] is not None:
            updates["role"] = payload["role"]
        if "status" in payload and payload["status"] is not None:
            updates["status"] = payload["status"]
            if payload["status"] == UserStatus.active.value:
                updates["approved_at"] = updates["updated_at"]
                updates["approved_by"] = actor_id
            elif payload["status"] == UserStatus.pending.value:
                updates["approved_at"] = None
                updates["approved_by"] = None

        updated = await self.collection.find_one_and_update(
            {"id": existing["id"]},
            {"$set": updates},
            projection={"_id": False},
            return_document=ReturnDocument.AFTER,
        )
        if updated is None:
            raise UserNotFoundError(f"User '{user_id}' was not found.")
        return updated


class InMemoryUserRepository:
    def __init__(self) -> None:
        now = iso_now()
        self.users: dict[str, dict] = {
            "user-master": {
                "id": "user-master",
                "email": "admin@localhost",
                "social_provider": SocialProvider.google.value,
                "provider_user_id": "dev-master",
                "role": UserRole.master.value,
                "status": UserStatus.active.value,
                "name": "개발 관리자",
                "position": "관리자",
                "department": "시스템",
                "approved_at": now,
                "approved_by": None,
                "last_login_at": now,
                "created_at": now,
                "updated_at": now,
            },
            "user-editor": {
                "id": "user-editor",
                "email": "editor@localhost",
                "social_provider": SocialProvider.google.value,
                "provider_user_id": "dev-editor",
                "role": UserRole.editor.value,
                "status": UserStatus.active.value,
                "name": "문서 편집자",
                "position": "전도사",
                "department": "예배팀",
                "approved_at": now,
                "approved_by": "user-master",
                "last_login_at": now,
                "created_at": now,
                "updated_at": now,
            },
        }

    @classmethod
    def bootstrap(cls) -> "InMemoryUserRepository":
        return cls()

    async def ensure_indexes(self) -> None:
        return None

    async def seed_master_user(
        self,
        provider: SocialProvider,
        provider_user_id: str,
        email: str,
        name: str,
    ) -> dict:
        for user in self.users.values():
            if (
                user["social_provider"] == provider.value
                and user["provider_user_id"] == provider_user_id
            ):
                user.update(
                    {
                        "email": email,
                        "role": UserRole.master.value,
                        "status": UserStatus.active.value,
                        "name": user.get("name") or name,
                        "position": user.get("position") or "관리자",
                        "department": user.get("department") or "시스템",
                        "updated_at": iso_now(),
                    }
                )
                if user.get("approved_at") is None:
                    user["approved_at"] = user["updated_at"]
                return deepcopy(user)

        now = iso_now()
        user = {
            "id": new_id("user"),
            "email": email,
            "social_provider": provider.value,
            "provider_user_id": provider_user_id,
            "role": UserRole.master.value,
            "status": UserStatus.active.value,
            "name": name,
            "position": "관리자",
            "department": "시스템",
            "approved_at": now,
            "approved_by": None,
            "last_login_at": now,
            "created_at": now,
            "updated_at": now,
        }
        self.users[user["id"]] = user
        return deepcopy(user)

    async def get_user(self, user_id: str) -> dict:
        user = self.users.get(user_id)
        if user is None:
            raise UserNotFoundError(f"User '{user_id}' was not found.")
        return deepcopy(user)

    async def list_users(self) -> list[dict]:
        users = [deepcopy(user) for user in self.users.values()]
        return sorted(users, key=lambda row: (_status_rank(row["status"]), row["created_at"]))

    async def login_with_oauth(self, identity: OAuthIdentity) -> dict:
        now = iso_now()
        for user in self.users.values():
            if (
                user["social_provider"] == identity.provider.value
                and user["provider_user_id"] == identity.provider_user_id
            ):
                user["email"] = identity.email
                if not user.get("name") and identity.name:
                    user["name"] = identity.name
                user["last_login_at"] = now
                user["updated_at"] = now
                return deepcopy(user)

        user_id = new_id("user")
        user = {
            "id": user_id,
            "email": identity.email,
            "social_provider": identity.provider.value,
            "provider_user_id": identity.provider_user_id,
            "role": UserRole.member.value,
            "status": UserStatus.pending.value,
            "name": identity.name,
            "position": None,
            "department": None,
            "approved_at": None,
            "approved_by": None,
            "last_login_at": now,
            "created_at": now,
            "updated_at": now,
        }
        self.users[user_id] = user
        return deepcopy(user)

    async def update_profile(self, user_id: str, payload: dict) -> dict:
        user = self.users.get(user_id)
        if user is None:
            raise UserNotFoundError(f"User '{user_id}' was not found.")
        user.update(
            {
                "name": payload["name"],
                "position": payload["position"],
                "department": payload["department"],
                "updated_at": iso_now(),
            }
        )
        return deepcopy(user)

    async def admin_update_user(self, user_id: str, payload: dict, actor_id: str) -> dict:
        user = self.users.get(user_id)
        if user is None:
            raise UserNotFoundError(f"User '{user_id}' was not found.")
        if "role" in payload and payload["role"] is not None:
            user["role"] = payload["role"]
        if "status" in payload and payload["status"] is not None:
            user["status"] = payload["status"]
            if payload["status"] == UserStatus.active.value:
                user["approved_at"] = iso_now()
                user["approved_by"] = actor_id
            elif payload["status"] == UserStatus.pending.value:
                user["approved_at"] = None
                user["approved_by"] = None
        user["updated_at"] = iso_now()
        return deepcopy(user)
