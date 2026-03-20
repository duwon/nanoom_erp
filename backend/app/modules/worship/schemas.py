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


class WorshipSectionType(StrEnum):
    song = "song"
    special_song = "special_song"
    scripture = "scripture"
    message = "message"
    notice = "notice"
    prayer = "prayer"
    media = "media"


class WorshipFieldType(StrEnum):
    text = "text"
    textarea = "textarea"
    song_search = "song_search"
    lyrics = "lyrics"
    scripture = "scripture"
    template = "template"


class WorshipGenerationRule(StrEnum):
    daily = "daily"
    sunday = "sunday"
    wednesday = "wednesday"
    friday = "friday"


class WorshipSlide(CamelModel):
    id: str
    label: str
    lines: list[str] = Field(default_factory=list)
    template_key: str = ""
    aspect_ratio: str = "16:9"
    notes: str = ""


class WorshipSection(CamelModel):
    id: str
    order: int = Field(ge=1)
    section_type: WorshipSectionType
    title: str
    detail: str = ""
    role: str = ""
    assignee_id: str | None = None
    assignee_name: str | None = None
    status: WorshipServiceStatus = WorshipServiceStatus.waiting
    duration_minutes: int = Field(default=0, ge=0)
    template_key: str = ""
    notes: str = ""
    content: dict[str, Any] = Field(default_factory=dict)
    slides: list[WorshipSlide] = Field(default_factory=list)
    updated_at: str

    @field_validator("title", "detail", "role", "template_key", "notes", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str:
        if value is None:
            return ""
        return value.strip()


class WorshipTaskFieldSpec(CamelModel):
    key: str = Field(min_length=1)
    label: str = Field(min_length=1)
    field_type: WorshipFieldType
    required: bool = True
    help_text: str = ""

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
    role: str = Field(min_length=1)
    scope: str = ""
    section_ids: list[str] = Field(default_factory=list)
    required_fields: list[WorshipTaskFieldSpec] = Field(default_factory=list)
    status: WorshipServiceStatus = WorshipServiceStatus.waiting
    due_at: str | None = None
    tips: str = ""
    guest_access: WorshipGuestAccess = Field(default_factory=WorshipGuestAccess)
    last_submitted_at: str | None = None

    @field_validator("role", "scope", "tips")
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


class WorshipTemplatePreset(CamelModel):
    key: str = Field(min_length=1)
    label: str = Field(min_length=1)
    description: str = ""

    @field_validator("key", "label", "description")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return value.strip()


class WorshipTemplateSectionPreset(CamelModel):
    id: str
    order: int = Field(ge=1)
    section_type: WorshipSectionType
    title: str = Field(min_length=1)
    detail: str = ""
    role: str = ""
    assignee_name: str | None = None
    duration_minutes: int = Field(default=0, ge=0)
    template_key: str = ""
    notes: str = ""
    content: dict[str, Any] = Field(default_factory=dict)

    @field_validator("id", "title", "detail", "role", "template_key", "notes")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return value.strip()


class WorshipTaskPreset(CamelModel):
    id: str
    role: str = Field(min_length=1)
    scope: str = ""
    section_ids: list[str] = Field(default_factory=list)
    required_fields: list[WorshipTaskFieldSpec] = Field(default_factory=list)
    due_offset_minutes: int = 0
    tips: str = ""

    @field_validator("id", "role", "scope", "tips")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return value.strip()


class WorshipTemplate(CamelModel):
    id: str
    service_kind: str = Field(min_length=1)
    display_name: str = Field(min_length=1)
    start_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    generation_rule: WorshipGenerationRule
    default_sections: list[WorshipTemplateSectionPreset] = Field(default_factory=list)
    task_presets: list[WorshipTaskPreset] = Field(default_factory=list)
    template_presets: list[WorshipTemplatePreset] = Field(default_factory=list)
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
    task_presets: list[WorshipTaskPreset] = Field(default_factory=list)
    template_presets: list[WorshipTemplatePreset] = Field(default_factory=list)
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


class WorshipCalendarDay(CamelModel):
    date: str
    date_label: str
    weekday_label: str
    services: list[WorshipCalendarService] = Field(default_factory=list)


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


class WorshipSectionUpdate(CamelModel):
    version: int = Field(ge=1)
    title: str | None = None
    detail: str | None = None
    role: str | None = None
    assignee_id: str | None = None
    assignee_name: str | None = None
    status: WorshipServiceStatus | None = None
    duration_minutes: int | None = Field(default=None, ge=0)
    template_key: str | None = None
    notes: str | None = None
    content: dict[str, Any] | None = None
    slides: list[WorshipSlide] | None = None

    @field_validator("title", "detail", "role", "assignee_id", "assignee_name", "template_key", "notes")
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


class WorshipGuestLinkResponse(CamelModel):
    task_id: str
    token: str
    input_url: str
    expires_at: str | None = None


class WorshipGuestTaskView(CamelModel):
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
    template_key: str = ""

    @field_validator("lyrics", "template_key")
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
    template_key: str = ""
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
