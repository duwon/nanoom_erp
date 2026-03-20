from __future__ import annotations

from enum import StrEnum

from pydantic import Field, field_validator

from app.modules.users.schemas import CamelModel


class DocumentStatus(StrEnum):
    draft = "draft"
    published = "published"
    superseded = "superseded"


class SharePermission(StrEnum):
    read = "read"
    edit = "edit"


class ShareTargetType(StrEnum):
    user = "user"
    department = "department"


class PermissionSubjectType(StrEnum):
    role = "role"
    department = "department"
    user = "user"


class BoardPermissionAction(StrEnum):
    read = "read"
    create = "create"
    manage = "manage"


class BoardPermissionRule(CamelModel):
    id: str
    board_id: str
    subject_type: PermissionSubjectType
    subject_id: str
    actions: list[BoardPermissionAction]
    created_at: str
    updated_at: str


class BoardPermissionRuleInput(CamelModel):
    subject_type: PermissionSubjectType
    subject_id: str = Field(min_length=1)
    actions: list[BoardPermissionAction] = Field(default_factory=list)

    @field_validator("subject_id")
    @classmethod
    def validate_subject_id(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("subject_id must not be blank")
        return trimmed


class UdmsBoard(CamelModel):
    id: str
    name: str
    description: str
    is_active: bool
    created_at: str
    updated_at: str


class BoardUpsert(CamelModel):
    name: str = Field(min_length=1)
    description: str = ""
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("name must not be blank")
        return trimmed


class ApprovalTemplate(CamelModel):
    id: str
    name: str
    description: str
    is_active: bool
    created_at: str
    updated_at: str


class DocumentShare(CamelModel):
    id: str
    doc_id: str
    target_type: ShareTargetType
    target_id: str
    permission: SharePermission
    created_by: str
    created_at: str
    updated_at: str


class DocumentShareInput(CamelModel):
    target_type: ShareTargetType
    target_id: str = Field(min_length=1)
    permission: SharePermission = SharePermission.read

    @field_validator("target_id")
    @classmethod
    def validate_target_id(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("target_id must not be blank")
        return trimmed


class DocumentAttachment(CamelModel):
    id: str
    doc_id: str
    storage_key: str
    file_name: str
    mime_type: str
    size_bytes: int
    created_by: str
    created_at: str
    updated_at: str


class UdmsDocumentSummary(CamelModel):
    id: str
    origin_doc_id: str
    prev_doc_id: str | None = None
    version_number: int
    board_id: str
    title: str
    content: str
    status: DocumentStatus
    approval_template_id: str | None = None
    created_by: str
    updated_by: str
    created_at: str
    updated_at: str


class UdmsDocumentDetail(UdmsDocumentSummary):
    attachments: list[DocumentAttachment] = Field(default_factory=list)
    shares: list[DocumentShare] = Field(default_factory=list)


class DocumentCreate(CamelModel):
    board_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    content: str = ""
    approval_template_id: str | None = None

    @field_validator("board_id", "title")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("value must not be blank")
        return trimmed


class DocumentUpdate(CamelModel):
    board_id: str | None = None
    title: str | None = None
    content: str | None = None
    approval_template_id: str | None = None

    @field_validator("board_id", "title")
    @classmethod
    def validate_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("value must not be blank")
        return trimmed


class SharedDocumentSummary(CamelModel):
    share: DocumentShare
    document: UdmsDocumentSummary
    direction: str


class SharedDocumentOverview(CamelModel):
    received: list[SharedDocumentSummary] = Field(default_factory=list)
    sent: list[SharedDocumentSummary] = Field(default_factory=list)
