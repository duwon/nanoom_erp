from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import Field, field_validator, model_validator

from app.modules.users.schemas import CamelModel


class WorshipServiceStatus(StrEnum):
    waiting = "waiting"
    progress = "progress"
    review = "review"
    complete = "complete"


class WorshipWorkspaceBucket(StrEnum):
    music = "music"
    content = "content"


class WorshipFieldType(StrEnum):
    # 섹션 필드에 직접 연결되는 타입
    title = "title"              # section.title (한 줄 텍스트)
    song_search = "song_search"  # section.title (곡 검색 UI)
    detail = "detail"            # section.detail (여러 줄 텍스트)
    notes = "notes"              # section.notes (여러 줄 텍스트)
    # 컨텐츠 전용 타입 (section.content에만 저장)
    lyrics = "lyrics"            # 슬라이드 자동 생성 (가사 입력)
    scripture = "scripture"      # 성경 조회 + 슬라이드 생성, section.detail에도 저장
    textarea = "textarea"        # 일반 여러 줄 텍스트
    # 하위 호환 (기존 데이터용, title과 동일하게 처리)
    text = "text"


class WorshipFieldBinding(StrEnum):
    """Deprecated: field_type에서 바인딩이 자동 결정됩니다. 기존 데이터 호환용으로만 유지."""
    value = "value"
    title = "title"
    detail = "detail"
    notes = "notes"
    slide_template_key = "slideTemplateKey"


class WorshipGenerationRule(StrEnum):
    daily = "daily"
    sunday = "sunday"
    wednesday = "wednesday"
    friday = "friday"


class WorshipSlide(CamelModel):
    id: str
    label: str
    lines: list[str] = Field(default_factory=list)
    slide_template_key: str = ""
    aspect_ratio: str = "16:9"
    notes: str = ""


class WorshipSectionCapabilities(CamelModel):
    can_edit: bool = False
    can_assign: bool = False
    can_share: bool = False
    can_add_sibling_song: bool = False
    can_remove: bool = False


class WorshipTaskFieldSpec(CamelModel):
    key: str = Field(min_length=1)
    label: str = Field(min_length=1)
    field_type: WorshipFieldType
    binding: WorshipFieldBinding | None = None  # deprecated, field_type으로 자동 결정
    required: bool = True
    help_text: str = ""

    @field_validator("field_type", mode="before")
    @classmethod
    def normalize_field_type(cls, value: object) -> object:
        """기존 데이터 호환: 더 이상 지원하지 않는 field_type을 적절한 값으로 변환."""
        deprecated: dict[str, str] = {
            "slide_template": "text",
            "template": "text",
        }
        if isinstance(value, str):
            return deprecated.get(value, value)
        return value

    @field_validator("key", "label", "help_text")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        return value.strip()


class WorshipGuestAccess(CamelModel):
    token_hash: str | None = None
    issued_at: str | None = None
    expires_at: str | None = None
    revoked_at: str | None = None
    last_opened_at: str | None = None


class WorshipTask(CamelModel):
    id: str
    section_id: str
    input_template_id: str = ""
    role: str = Field(min_length=1)
    scope: str = ""
    required_fields: list[WorshipTaskFieldSpec] = Field(default_factory=list)
    status: WorshipServiceStatus = WorshipServiceStatus.waiting
    due_at: str | None = None
    tips: str = ""
    guest_access: WorshipGuestAccess = Field(default_factory=WorshipGuestAccess)
    last_submitted_at: str | None = None

    @field_validator("input_template_id", "role", "scope", "tips")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return value.strip()


class WorshipReviewSummary(CamelModel):
    total_sections: int
    complete_sections: int
    progress_sections: int
    waiting_sections: int
    review_sections: int
    pending_review_count: int
    pending_task_count: int


class WorshipSectionTypeDefinition(CamelModel):
    code: str = Field(min_length=1)
    label: str = Field(min_length=1)
    description: str = ""
    workspace_bucket: WorshipWorkspaceBucket
    default_title: str = ""
    default_role: str = ""
    default_duration_minutes: int = Field(default=0, ge=0)
    default_due_offset_minutes: int = Field(default=0, ge=0)
    default_input_template_id: str = ""
    default_slide_template_key: str = ""
    is_active: bool = True
    sort_order: int = Field(default=0, ge=0)
    usage_count: int = Field(default=0, ge=0)

    @field_validator(
        "code",
        "label",
        "description",
        "default_title",
        "default_role",
        "default_input_template_id",
        "default_slide_template_key",
    )
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return value.strip()


class WorshipSectionTypeDefinitionUpsert(CamelModel):
    code: str = Field(min_length=1)
    label: str = Field(min_length=1)
    description: str = ""
    workspace_bucket: WorshipWorkspaceBucket
    default_title: str = ""
    default_role: str = ""
    default_duration_minutes: int = Field(default=0, ge=0)
    default_due_offset_minutes: int = Field(default=0, ge=0)
    default_input_template_id: str = ""
    default_slide_template_key: str = ""
    is_active: bool = True
    sort_order: int = Field(default=0, ge=0)

    @field_validator(
        "code",
        "label",
        "description",
        "default_title",
        "default_role",
        "default_input_template_id",
        "default_slide_template_key",
    )
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        return value.strip()


class WorshipInputTemplate(CamelModel):
    id: str
    label: str = Field(min_length=1)
    description: str = ""
    tips: str = ""
    fields: list[WorshipTaskFieldSpec] = Field(default_factory=list)
    is_active: bool = True
    usage_count: int = Field(default=0, ge=0)
    created_at: str
    updated_at: str

    @field_validator("id", "label", "description", "tips")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return value.strip()


class WorshipInputTemplateUpsert(CamelModel):
    id: str = Field(min_length=1)
    label: str = Field(min_length=1)
    description: str = ""
    tips: str = ""
    fields: list[WorshipTaskFieldSpec] = Field(default_factory=list)
    is_active: bool = True

    @field_validator("id", "label", "description", "tips")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed and value != "":
            raise ValueError("value must not be blank")
        return trimmed


class WorshipSlideTemplate(CamelModel):
    key: str = Field(min_length=1)
    label: str = Field(min_length=1)
    description: str = ""
    is_active: bool = True
    usage_count: int = Field(default=0, ge=0)
    created_at: str
    updated_at: str

    @field_validator("key", "label", "description")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return value.strip()


class WorshipSlideTemplateUpsert(CamelModel):
    key: str = Field(min_length=1)
    label: str = Field(min_length=1)
    description: str = ""
    is_active: bool = True

    @field_validator("key", "label", "description")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed and value != "":
            raise ValueError("value must not be blank")
        return trimmed


class WorshipTemplateSectionPreset(CamelModel):
    id: str
    order: int = Field(ge=1)
    section_type_code: str = Field(min_length=1)
    title: str = Field(min_length=1)
    detail: str = ""
    role: str = ""
    assignee_name: str | None = None
    duration_minutes: int = Field(default=0, ge=0)
    due_offset_minutes: int = Field(default=0, ge=0)
    input_template_id: str = Field(min_length=1)
    slide_template_key: str = ""
    workspace_bucket: WorshipWorkspaceBucket
    notes: str = ""
    content: dict[str, Any] = Field(default_factory=dict)

    @field_validator(
        "id",
        "section_type_code",
        "title",
        "detail",
        "role",
        "input_template_id",
        "slide_template_key",
        "notes",
    )
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return value.strip()


class WorshipSection(CamelModel):
    id: str
    order: int = Field(ge=1)
    section_type_code: str = Field(min_length=1)
    workspace_bucket: WorshipWorkspaceBucket
    title: str
    detail: str = ""
    role: str = ""
    assignee_id: str | None = None
    assignee_name: str | None = None
    status: WorshipServiceStatus = WorshipServiceStatus.waiting
    duration_minutes: int = Field(default=0, ge=0)
    due_offset_minutes: int = Field(default=0, ge=0)
    input_template_id: str = ""
    slide_template_key: str = ""
    notes: str = ""
    content: dict[str, Any] = Field(default_factory=dict)
    slides: list[WorshipSlide] = Field(default_factory=list)
    capabilities: WorshipSectionCapabilities = Field(default_factory=WorshipSectionCapabilities)
    updated_at: str

    @field_validator(
        "section_type_code",
        "title",
        "detail",
        "role",
        "input_template_id",
        "slide_template_key",
        "notes",
        mode="before",
    )
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str:
        if value is None:
            return ""
        return value.strip()


class WorshipTemplate(CamelModel):
    id: str
    service_kind: str = Field(min_length=1)
    display_name: str = Field(min_length=1)
    start_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    generation_rule: WorshipGenerationRule
    default_sections: list[WorshipTemplateSectionPreset] = Field(default_factory=list)
    is_active: bool = True
    created_at: str
    updated_at: str

    @field_validator("service_kind", "display_name", "start_time")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        return value.strip()


class WorshipTemplateUpsert(CamelModel):
    service_kind: str = Field(min_length=1)
    display_name: str = Field(min_length=1)
    start_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    generation_rule: WorshipGenerationRule
    default_sections: list[WorshipTemplateSectionPreset] = Field(default_factory=list)
    is_active: bool = True

    @field_validator("service_kind", "display_name", "start_time")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("value must not be blank")
        return trimmed


class WorshipCalendarService(CamelModel):
    id: str
    service_kind: str
    service_name: str
    start_at: str
    status: WorshipServiceStatus
    review_summary: WorshipReviewSummary


class WorshipCalendarTemplateOption(CamelModel):
    template_id: str
    service_kind: str
    display_name: str
    start_time: str


class WorshipCalendarDay(CamelModel):
    date: str
    date_label: str
    weekday_label: str
    services: list[WorshipCalendarService] = Field(default_factory=list)
    available_templates: list[WorshipCalendarTemplateOption] = Field(default_factory=list)


class WorshipCalendarResponse(CamelModel):
    anchor_date: str
    days: list[WorshipCalendarDay] = Field(default_factory=list)
    default_service_id: str | None = None


class WorshipServiceMetadata(CamelModel):
    created_at: str
    updated_at: str


class WorshipServiceDetail(CamelModel):
    id: str
    date: str
    service_kind: str
    service_name: str
    start_at: str
    summary: str = ""
    template_id: str
    version: int
    status: WorshipServiceStatus
    sections: list[WorshipSection] = Field(default_factory=list)
    tasks: list[WorshipTask] = Field(default_factory=list)
    review_summary: WorshipReviewSummary
    export_snapshot: dict[str, Any] = Field(default_factory=dict)
    metadata: WorshipServiceMetadata


class WorshipServiceUpdate(CamelModel):
    version: int = Field(ge=1)
    summary: str | None = None
    service_name: str | None = None
    start_at: str | None = None

    @field_validator("summary", "service_name", "start_at")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()


class WorshipServiceCreate(CamelModel):
    target_date: str = Field(min_length=10, max_length=10)
    template_id: str = Field(min_length=1)

    @field_validator("target_date", "template_id")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("value must not be blank")
        return trimmed


class WorshipSectionUpdate(CamelModel):
    version: int = Field(ge=1)
    title: str | None = None
    detail: str | None = None
    role: str | None = None
    assignee_id: str | None = None
    assignee_name: str | None = None
    status: WorshipServiceStatus | None = None
    duration_minutes: int | None = Field(default=None, ge=0)
    due_offset_minutes: int | None = Field(default=None, ge=0)
    input_template_id: str | None = None
    slide_template_key: str | None = None
    notes: str | None = None
    content: dict[str, Any] | None = None
    slides: list[WorshipSlide] | None = None
    editor_values: dict[str, Any] | None = None
    mark_complete: bool | None = None

    @field_validator(
        "title",
        "detail",
        "role",
        "assignee_id",
        "assignee_name",
        "input_template_id",
        "slide_template_key",
        "notes",
    )
    @classmethod
    def normalize_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None


class WorshipSectionReorderEntry(CamelModel):
    section_id: str = Field(min_length=1)
    order: int = Field(ge=1)

    @field_validator("section_id")
    @classmethod
    def normalize_section_id(cls, value: str) -> str:
        return value.strip()


class WorshipSectionReorderRequest(CamelModel):
    version: int = Field(ge=1)
    sections: list[WorshipSectionReorderEntry] = Field(default_factory=list)


class WorshipSectionCreate(CamelModel):
    version: int = Field(ge=1)
    after_section_id: str | None = None
    section_type_code: str = Field(min_length=1)

    @field_validator("after_section_id", "section_type_code")
    @classmethod
    def normalize_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None


class WorshipGuestLinkResponse(CamelModel):
    task_id: str
    token: str
    input_url: str
    expires_at: str | None = None


class WorshipGuestTaskView(CamelModel):
    task_id: str
    section_id: str
    service_id: str
    service_name: str
    date: str
    role: str
    scope: str
    due_at: str | None = None
    tips: str = ""
    status: WorshipServiceStatus
    required_fields: list[WorshipTaskFieldSpec] = Field(default_factory=list)
    values: dict[str, Any] = Field(default_factory=dict)


class WorshipGuestInputPayload(CamelModel):
    values: dict[str, Any] = Field(default_factory=dict)
    mark_complete: bool = False


class WorshipSongLookupItem(CamelModel):
    id: str
    title: str
    artist: str = ""
    recent_use_count: int = 0
    tags: list[str] = Field(default_factory=list)


class WorshipScriptureLookupResponse(CamelModel):
    reference: str
    text: str
    translation: str = "KRV"
    slides: list[WorshipSlide] = Field(default_factory=list)


class WorshipLyricsParseRequest(CamelModel):
    lyrics: str = Field(min_length=1)
    slide_template_key: str = ""

    @field_validator("lyrics", "slide_template_key")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return value.strip()


class WorshipLyricsParseResponse(CamelModel):
    slides: list[WorshipSlide] = Field(default_factory=list)


class WorshipReviewItem(CamelModel):
    section_id: str
    order: int
    title: str
    detail: str = ""
    status: WorshipServiceStatus
    slide_template_key: str = ""
    notes: str = ""


class WorshipPresentationPreview(CamelModel):
    service_id: str
    service_name: str
    generated_at: str
    sections: list[WorshipSection] = Field(default_factory=list)


class WorshipReviewResponse(CamelModel):
    service: WorshipServiceDetail
    items: list[WorshipReviewItem] = Field(default_factory=list)
    preview: WorshipPresentationPreview


class WorshipPresentationActivateRequest(CamelModel):
    selected_section_ids: list[str] = Field(default_factory=list)


class WorshipPresentationState(CamelModel):
    service_id: str | None = None
    active_section_id: str | None = None
    title: str
    content: str
    updated_at: str | None = None


class WorshipPresentationCompatOrderItem(CamelModel):
    id: str
    title: str
    order: int
    content: str
    is_active: bool = False
    updated_at: str | None = None


class WorshipCompatOrderItemUpdate(CamelModel):
    title: str = Field(min_length=1, max_length=120)
    content: str = Field(min_length=1, max_length=5000)


class ScriptureLookupQuery(CamelModel):
    book: str = Field(min_length=1)
    chapter: int = Field(ge=1)
    verse_start: int = Field(alias="verseStart", ge=1)
    verse_end: int | None = Field(alias="verseEnd", default=None, ge=1)
    translation: str = "KRV"

    @field_validator("book", "translation")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def ensure_end_is_valid(self) -> "ScriptureLookupQuery":
        if self.verse_end is not None and self.verse_end < self.verse_start:
            raise ValueError("verseEnd must be greater than or equal to verseStart")
        return self
