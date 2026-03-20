from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import Field, field_validator, model_validator

from app.modules.users.schemas import CamelModel


class DocumentStatus(StrEnum):
    draft = "draft"
    published = "published"
    locked = "locked"
    archived = "archived"


class DocumentEditorType(StrEnum):
    tiptap = "tiptap"


class PermissionSubjectType(StrEnum):
    role = "role"
    department = "department"
    user = "user"


class TargetPolicyAction(StrEnum):
    read = "read"
    create = "create"
    manage = "manage"


class DocumentAclEffect(StrEnum):
    allow = "allow"
    deny = "deny"


class DocumentAclAction(StrEnum):
    read = "read"
    edit = "edit"
    manage = "manage"
    publish = "publish"


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


class TargetTypeCatalogEntry(CamelModel):
    target_type: str = Field(min_length=1)
    label: str = Field(min_length=1)
    namespace: str = Field(min_length=1)
    deep_link_template: str = Field(min_length=1)
    requires_existing_parent: bool
    document_title_hint: str | None = None
    is_enabled: bool

    @field_validator("target_type", "label", "namespace", "deep_link_template")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("value must not be blank")
        return trimmed


class DocumentHeader(CamelModel):
    title: str
    category: str = ""
    tags: list[str] = Field(default_factory=list)
    author_id: str | None = None


class DocumentLink(CamelModel):
    target_type: str = Field(min_length=1)
    target_id: str = Field(min_length=1)
    deep_link: str | None = None

    @field_validator("target_type", "target_id")
    @classmethod
    def validate_target_fields(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("value must not be blank")
        return trimmed


class DocumentAttachment(CamelModel):
    id: str
    file_name: str
    mime_type: str
    size_bytes: int
    storage_key: str
    version: int
    created_by: str
    created_at: str
    updated_at: str


class DocumentRevision(CamelModel):
    id: str
    document_id: str
    version: int
    header: DocumentHeader
    body: str | None = None
    summary: str
    editor_type: DocumentEditorType
    attachments: list[DocumentAttachment] = Field(default_factory=list)
    module_data: dict[str, Any] = Field(default_factory=dict)
    change_log: str = ""
    created_by: str
    created_at: str
    is_current: bool = False
    is_published: bool = False


class DocumentMetadata(CamelModel):
    version: int
    is_deleted: bool = False
    archived_at: str | None = None
    created_at: str
    updated_at: str


class DocumentState(CamelModel):
    status: DocumentStatus


class DocumentAclRule(CamelModel):
    subject_type: PermissionSubjectType
    subject_id: str
    actions: list[DocumentAclAction]
    effect: DocumentAclEffect = DocumentAclEffect.allow

    @field_validator("subject_id")
    @classmethod
    def validate_subject_id(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("subject_id must not be blank")
        return trimmed


class ExternalShareLink(CamelModel):
    id: str
    label: str
    token: str
    expires_at: str | None = None
    can_download: bool = True
    created_by: str
    created_at: str


class DocumentSecurity(CamelModel):
    acl: list[DocumentAclRule] = Field(default_factory=list)
    external_shares: list[ExternalShareLink] = Field(default_factory=list)


class DocumentSecuritySummary(CamelModel):
    acl_count: int
    external_share_count: int
    has_deny_rules: bool


class DocumentCapabilities(CamelModel):
    effective_actions: list[str] = Field(default_factory=list)
    can_read: bool
    can_edit_working_copy: bool
    can_publish: bool
    can_manage_security: bool
    can_create_working_copy: bool


class DocumentSummary(CamelModel):
    id: str
    header: DocumentHeader
    link: DocumentLink
    state: DocumentState
    metadata: DocumentMetadata
    current_revision: DocumentRevision
    published_revision: DocumentRevision | None = None
    working_revision: DocumentRevision | None = None
    security_summary: DocumentSecuritySummary
    module_data: dict[str, Any] = Field(default_factory=dict)
    capabilities: DocumentCapabilities


class DocumentDetail(DocumentSummary):
    security: DocumentSecurity


class DocumentCreate(CamelModel):
    title: str = Field(min_length=1)
    category: str = ""
    tags: list[str] = Field(default_factory=list)
    target_type: str = Field(min_length=1)
    target_id: str = Field(min_length=1)
    body: str = ""
    editor_type: DocumentEditorType = DocumentEditorType.tiptap
    module_data: dict[str, Any] = Field(default_factory=dict)
    change_log: str = ""

    @field_validator("title", "target_type", "target_id")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("value must not be blank")
        return trimmed

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, value: list[str]) -> list[str]:
        return [item.strip() for item in value if item.strip()]


class DocumentUpdate(CamelModel):
    title: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    target_type: str | None = None
    target_id: str | None = None
    body: str | None = None
    editor_type: DocumentEditorType | None = None
    module_data: dict[str, Any] | None = None
    change_log: str | None = None

    @field_validator("title", "target_type", "target_id")
    @classmethod
    def validate_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("value must not be blank")
        return trimmed

    @field_validator("tags")
    @classmethod
    def normalize_optional_tags(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return [item.strip() for item in value if item.strip()]


class DocumentRollbackRequest(CamelModel):
    target_version: int = Field(ge=1)


class DocumentAclRuleInput(CamelModel):
    subject_type: PermissionSubjectType
    subject_id: str = Field(min_length=1)
    actions: list[DocumentAclAction] = Field(default_factory=list)
    effect: DocumentAclEffect = DocumentAclEffect.allow

    @field_validator("subject_id")
    @classmethod
    def validate_subject_id(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("subject_id must not be blank")
        return trimmed


class DocumentSecurityUpdate(CamelModel):
    acl: list[DocumentAclRuleInput] = Field(default_factory=list)


class ExternalShareCreate(CamelModel):
    label: str = Field(min_length=1)
    expires_at: str | None = None
    can_download: bool = True

    @field_validator("label")
    @classmethod
    def validate_label(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("label must not be blank")
        return trimmed


class SharedDocumentRow(CamelModel):
    document: DocumentSummary
    access_source: str


class ExternalShareRow(CamelModel):
    document_id: str
    document_title: str
    link: ExternalShareLink
    target_type: str
    target_id: str


class SharedDocumentsOverview(CamelModel):
    accessible: list[SharedDocumentRow] = Field(default_factory=list)
    external_links: list[ExternalShareRow] = Field(default_factory=list)


class TargetPolicyRule(CamelModel):
    id: str
    target_type: str
    target_id: str
    subject_type: PermissionSubjectType
    subject_id: str
    actions: list[TargetPolicyAction]
    created_at: str
    updated_at: str


class TargetPolicyRuleInput(CamelModel):
    subject_type: PermissionSubjectType
    subject_id: str = Field(min_length=1)
    actions: list[TargetPolicyAction] = Field(default_factory=list)

    @field_validator("subject_id")
    @classmethod
    def validate_subject_id(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("subject_id must not be blank")
        return trimmed


class ApprovalCompletedHookPayload(CamelModel):
    document_id: str | None = None
    target_id: str | None = None

    @model_validator(mode="after")
    def ensure_selector(self) -> "ApprovalCompletedHookPayload":
        if not self.document_id and not self.target_id:
            raise ValueError("document_id or target_id is required")
        return self


class ParentDeletedHookPayload(CamelModel):
    target_type: str = Field(min_length=1)
    target_id: str = Field(min_length=1)
    policy: str = Field(pattern="^(cascade|orphan)$")

    @field_validator("target_type", "target_id")
    @classmethod
    def validate_target_fields(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("value must not be blank")
        return trimmed
