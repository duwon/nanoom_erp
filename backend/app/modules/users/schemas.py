from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, field_validator


def to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)


class SocialProvider(StrEnum):
    google = "google"
    kakao = "kakao"


class UserRole(StrEnum):
    master = "master"
    final_approver = "final_approver"
    editor = "editor"
    member = "member"


class UserStatus(StrEnum):
    pending = "pending"
    active = "active"
    blocked = "blocked"


class User(CamelModel):
    id: str
    email: str
    social_provider: SocialProvider
    provider_user_id: str
    role: UserRole
    status: UserStatus
    name: str | None = None
    position: str | None = None
    department: str | None = None
    approved_at: str | None = None
    approved_by: str | None = None
    last_login_at: str | None = None
    created_at: str
    updated_at: str


class UserProfileUpdate(BaseModel):
    name: str = Field(min_length=1)
    position: str = Field(min_length=1)
    department: str = Field(min_length=1)

    @field_validator("name", "position", "department")
    @classmethod
    def validate_not_blank(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Value must not be blank")
        return trimmed


class AdminUserUpdate(BaseModel):
    role: UserRole | None = None
    status: UserStatus | None = None


def is_profile_complete(user: dict | User) -> bool:
    if isinstance(user, User):
        name = user.name
        position = user.position
        department = user.department
    else:
        name = user.get("name")
        position = user.get("position")
        department = user.get("department")
    return bool(name and position and department)
