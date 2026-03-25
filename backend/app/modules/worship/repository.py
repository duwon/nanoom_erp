from __future__ import annotations

from copy import deepcopy
from datetime import date
from typing import Any, Protocol

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, ReturnDocument

from app.core.store import ConflictError, NotFoundError, iso_now, new_id
from app.modules.worship.schemas import WorshipGenerationRule, WorshipPresentationState, WorshipWorkspaceBucket

WORSHIP_ADMIN_SCHEMA_VERSION = 3


def _clone(value: Any) -> Any:
    return deepcopy(value)


def _field_spec(
    key: str,
    label: str,
    field_type: str,
    *,
    required: bool = True,
    help_text: str = "",
) -> dict[str, Any]:
    return {
        "key": key,
        "label": label,
        "field_type": field_type,
        "required": required,
        "help_text": help_text,
    }


def default_slide_templates() -> list[dict[str, Any]]:
    return [
        {"key": "lyrics-16x9", "label": "가사 16:9", "description": "찬양 가사 기본 슬라이드", "is_active": True},
        {"key": "scripture-main", "label": "성경 본문", "description": "성경 본문 표시용 슬라이드", "is_active": True},
        {"key": "message-notes", "label": "말씀 메모", "description": "설교 메모/요약 슬라이드", "is_active": True},
        {"key": "notice-card", "label": "공지 카드", "description": "공지와 안내 카드형 슬라이드", "is_active": True},
        {"key": "prayer-card", "label": "기도 카드", "description": "기도문과 주기도문 표시용 슬라이드", "is_active": True},
    ]


def default_input_templates() -> list[dict[str, Any]]:
    return [
        {
            "id": "input-song-lyrics",
            "label": "찬양 입력",
            "description": "찬양 제목과 가사를 입력합니다.",
            "tips": "제목과 가사를 입력하면 슬라이드가 자동으로 나뉩니다.",
            "fields": [
                _field_spec("f1", "곡 제목", "song_search"),
                _field_spec("f2", "가사", "lyrics"),
            ],
            "is_active": True,
        },
        {
            "id": "input-special-song",
            "label": "특송 입력",
            "description": "특송 제목과 가사를 입력합니다.",
            "tips": "특송 제목과 가사를 입력해 주세요.",
            "fields": [
                _field_spec("f1", "특송 제목", "title"),
                _field_spec("f2", "가사", "lyrics"),
            ],
            "is_active": True,
        },
        {
            "id": "input-scripture",
            "label": "성경 본문 입력",
            "description": "본문을 선택하고 슬라이드를 생성합니다.",
            "tips": "예: 요한복음 3:16-17",
            "fields": [
                _field_spec("f1", "본문", "scripture"),
            ],
            "is_active": True,
        },
        {
            "id": "input-message-notes",
            "label": "말씀 메모 입력",
            "description": "설교 메모를 입력합니다.",
            "tips": "메모는 운영팀과 방송팀 확인용입니다.",
            "fields": [
                _field_spec("f1", "메모", "notes", required=False),
            ],
            "is_active": True,
        },
        {
            "id": "input-notice",
            "label": "공지 입력",
            "description": "공지 제목과 내용을 입력합니다.",
            "tips": "카드형 공지 슬라이드 기본값을 사용합니다.",
            "fields": [
                _field_spec("f1", "제목", "title"),
                _field_spec("f2", "내용", "detail", required=False),
            ],
            "is_active": True,
        },
        {
            "id": "input-prayer",
            "label": "기도문 입력",
            "description": "기도 제목과 기도문을 입력합니다.",
            "tips": "기도자 이름은 순서 제목이나 메모로 보완할 수 있습니다.",
            "fields": [
                _field_spec("f1", "제목", "title"),
                _field_spec("f2", "기도문", "detail", required=False),
            ],
            "is_active": True,
        },
        {
            "id": "input-media-note",
            "label": "미디어/안내 입력",
            "description": "간증, 영상, 주기도문 등 일반 콘텐츠 입력용 템플릿입니다.",
            "tips": "제목과 메모를 입력해 주세요.",
            "fields": [
                _field_spec("f1", "제목", "title"),
                _field_spec("f2", "메모", "notes", required=False),
            ],
            "is_active": True,
        },
        {
            "id": "input-call-to-worship",
            "label": "예배로 부름 입력",
            "description": "예배로 부름에 사용할 성경 본문을 입력합니다.",
            "tips": "예: 이사야 53:5-6",
            "fields": [
                _field_spec("f1", "본문", "scripture"),
            ],
            "is_active": True,
        },
        {
            "id": "input-antiphonal",
            "label": "성경교독 입력",
            "description": "교독에 사용할 성경 본문을 입력합니다.",
            "tips": "예: 시편 40:1-5",
            "fields": [
                _field_spec("f1", "본문", "scripture"),
            ],
            "is_active": True,
        },
    ]


def default_section_type_definitions() -> list[dict[str, Any]]:
    return [
        {
            "code": "call_to_worship",
            "label": "예배로 부름",
            "description": "성경 본문으로 예배를 시작하는 순서",
            "workspace_bucket": WorshipWorkspaceBucket.content.value,
            "default_title": "예배로 부름",
            "default_role": "인도자",
            "default_duration_minutes": 3,
            "default_due_offset_minutes": 120,
            "default_input_template_id": "input-call-to-worship",
            "default_slide_template_key": "scripture-main",
            "is_active": True,
            "sort_order": 5,
        },
        {
            "code": "song",
            "label": "찬양",
            "description": "찬양/찬송 순서",
            "workspace_bucket": WorshipWorkspaceBucket.music.value,
            "default_title": "찬양",
            "default_role": "찬양팀",
            "default_duration_minutes": 10,
            "default_due_offset_minutes": 180,
            "default_input_template_id": "input-song-lyrics",
            "default_slide_template_key": "lyrics-16x9",
            "is_active": True,
            "sort_order": 10,
        },
        {
            "code": "confession",
            "label": "신앙고백",
            "description": "사도신경 등 신앙고백 순서",
            "workspace_bucket": WorshipWorkspaceBucket.content.value,
            "default_title": "신앙고백",
            "default_role": "다함께",
            "default_duration_minutes": 2,
            "default_due_offset_minutes": 120,
            "default_input_template_id": "",
            "default_slide_template_key": "prayer-card",
            "is_active": True,
            "sort_order": 15,
        },
        {
            "code": "antiphonal",
            "label": "성경교독",
            "description": "교독문/성경교독 순서",
            "workspace_bucket": WorshipWorkspaceBucket.content.value,
            "default_title": "성경교독",
            "default_role": "한절씩 교독",
            "default_duration_minutes": 3,
            "default_due_offset_minutes": 120,
            "default_input_template_id": "input-antiphonal",
            "default_slide_template_key": "scripture-main",
            "is_active": True,
            "sort_order": 25,
        },
        {
            "code": "special_song",
            "label": "특송",
            "description": "특송 순서",
            "workspace_bucket": WorshipWorkspaceBucket.music.value,
            "default_title": "특송",
            "default_role": "특송팀",
            "default_duration_minutes": 5,
            "default_due_offset_minutes": 150,
            "default_input_template_id": "input-special-song",
            "default_slide_template_key": "lyrics-16x9",
            "is_active": True,
            "sort_order": 20,
        },
        {
            "code": "scripture",
            "label": "성경 봉독",
            "description": "성경 본문과 봉독 순서",
            "workspace_bucket": WorshipWorkspaceBucket.content.value,
            "default_title": "성경 봉독",
            "default_role": "말씀 담당",
            "default_duration_minutes": 5,
            "default_due_offset_minutes": 120,
            "default_input_template_id": "input-scripture",
            "default_slide_template_key": "scripture-main",
            "is_active": True,
            "sort_order": 30,
        },
        {
            "code": "message",
            "label": "말씀",
            "description": "설교/메시지 순서",
            "workspace_bucket": WorshipWorkspaceBucket.content.value,
            "default_title": "말씀",
            "default_role": "설교자",
            "default_duration_minutes": 25,
            "default_due_offset_minutes": 120,
            "default_input_template_id": "input-message-notes",
            "default_slide_template_key": "message-notes",
            "is_active": True,
            "sort_order": 40,
        },
        {
            "code": "notice",
            "label": "공지",
            "description": "광고와 교회 소식",
            "workspace_bucket": WorshipWorkspaceBucket.content.value,
            "default_title": "공지",
            "default_role": "미디어팀",
            "default_duration_minutes": 4,
            "default_due_offset_minutes": 90,
            "default_input_template_id": "input-notice",
            "default_slide_template_key": "notice-card",
            "is_active": True,
            "sort_order": 50,
        },
        {
            "code": "prayer",
            "label": "기도",
            "description": "대표기도, 주기도문, 합심기도 등",
            "workspace_bucket": WorshipWorkspaceBucket.content.value,
            "default_title": "기도",
            "default_role": "방송팀",
            "default_duration_minutes": 5,
            "default_due_offset_minutes": 90,
            "default_input_template_id": "input-prayer",
            "default_slide_template_key": "prayer-card",
            "is_active": True,
            "sort_order": 60,
        },
        {
            "code": "media",
            "label": "미디어",
            "description": "간증, 영상, 선언문 등 일반 콘텐츠",
            "workspace_bucket": WorshipWorkspaceBucket.content.value,
            "default_title": "미디어",
            "default_role": "미디어팀",
            "default_duration_minutes": 5,
            "default_due_offset_minutes": 90,
            "default_input_template_id": "input-media-note",
            "default_slide_template_key": "notice-card",
            "is_active": True,
            "sort_order": 70,
        },
        {
            "code": "offering",
            "label": "헌금봉헌",
            "description": "헌금 봉헌 순서",
            "workspace_bucket": WorshipWorkspaceBucket.content.value,
            "default_title": "헌금봉헌",
            "default_role": "다함께",
            "default_duration_minutes": 4,
            "default_due_offset_minutes": 90,
            "default_input_template_id": "",
            "default_slide_template_key": "notice-card",
            "is_active": True,
            "sort_order": 75,
        },
        {
            "code": "benediction",
            "label": "축도",
            "description": "예배 마침 축도",
            "workspace_bucket": WorshipWorkspaceBucket.content.value,
            "default_title": "축도",
            "default_role": "담임목사",
            "default_duration_minutes": 2,
            "default_due_offset_minutes": 60,
            "default_input_template_id": "",
            "default_slide_template_key": "prayer-card",
            "is_active": True,
            "sort_order": 90,
        },
    ]


def _default_section_type_map() -> dict[str, dict[str, Any]]:
    return {item["code"]: item for item in default_section_type_definitions()}


def _section_preset(
    section_id: str,
    order: int,
    section_type_code: str,
    *,
    title: str | None = None,
    detail: str = "",
    role: str | None = None,
    duration_minutes: int | None = None,
    due_offset_minutes: int | None = None,
    input_template_id: str | None = None,
    slide_template_key: str | None = None,
    notes: str = "",
    content: dict[str, Any] | None = None,
    assignee_name: str | None = None,
) -> dict[str, Any]:
    definition = _default_section_type_map()[section_type_code]
    return {
        "id": section_id,
        "order": order,
        "section_type_code": section_type_code,
        "workspace_bucket": definition["workspace_bucket"],
        "title": title or definition["default_title"],
        "detail": detail,
        "role": role if role is not None else definition["default_role"],
        "assignee_name": assignee_name,
        "duration_minutes": duration_minutes if duration_minutes is not None else definition["default_duration_minutes"],
        "due_offset_minutes": due_offset_minutes if due_offset_minutes is not None else definition["default_due_offset_minutes"],
        "input_template_id": input_template_id or definition["default_input_template_id"],
        "slide_template_key": slide_template_key if slide_template_key is not None else definition["default_slide_template_key"],
        "notes": notes,
        "content": content or {},
    }


def default_presentation_state() -> dict[str, Any]:
    return WorshipPresentationState(
        title="예배 대기 중",
        content="예배 검토 화면에서 송출할 섹션을 선택해 주세요.",
        updated_at=None,
    ).model_dump()


def default_worship_templates() -> list[dict[str, Any]]:
    return [
        {
            "id": "wtemplate-dawn",
            "service_kind": "dawn",
            "display_name": "새벽기도",
            "start_time": "05:30",
            "generation_rule": WorshipGenerationRule.daily.value,
            "default_sections": [
                _section_preset("opening-song", 1, "song", title="찬양", duration_minutes=10),
                _section_preset("scripture", 2, "scripture", title="성경 본문", role="말씀 담당", duration_minutes=5),
                _section_preset("message", 3, "message", title="말씀", role="설교자", duration_minutes=20),
                _section_preset("prayer", 4, "prayer", title="기도", role="방송팀", duration_minutes=5),
            ],
            "is_active": True,
        },
        {
            "id": "wtemplate-sunday1",
            "service_kind": "sunday1",
            "display_name": "주일 1부 예배",
            "start_time": "09:00",
            "generation_rule": WorshipGenerationRule.sunday.value,
            "default_sections": [
                _section_preset("s1-call", 1, "call_to_worship", title="예배로 부름", role="인도자", duration_minutes=3),
                _section_preset("s1-confession", 2, "confession", title="신앙고백", role="다함께", duration_minutes=2),
                _section_preset("s1-antiphonal", 3, "antiphonal", title="성경교독", role="한절씩 교독", duration_minutes=3),
                _section_preset("s1-praise", 4, "song", title="경배와 찬양", role="찬양팀", duration_minutes=10),
                _section_preset("s1-prayer", 5, "prayer", title="회중기도", role="인도자", duration_minutes=5),
                _section_preset("s1-scripture", 6, "scripture", title="성경봉독", role="인도자", duration_minutes=4),
                _section_preset("s1-special-song", 7, "special_song", title="찬양", role="찬양팀", duration_minutes=5),
                _section_preset("s1-message", 8, "message", title="말씀", role="설교자", duration_minutes=25),
                _section_preset("s1-notice", 9, "notice", title="교회소식", role="인도자", duration_minutes=4),
                _section_preset("s1-hymn", 10, "song", title="찬송", role="찬양팀", duration_minutes=4),
                _section_preset("s1-offering", 11, "offering", title="헌금봉헌", role="다함께", duration_minutes=4),
                _section_preset("s1-hymn2", 12, "song", title="찬송", role="다함께", duration_minutes=2),
                _section_preset("s1-benediction", 13, "benediction", title="축도", role="담임목사", duration_minutes=2),
            ],
            "is_active": True,
        },
        {
            "id": "wtemplate-sunday2",
            "service_kind": "sunday2",
            "display_name": "주일 2부 예배",
            "start_time": "11:00",
            "generation_rule": WorshipGenerationRule.sunday.value,
            "default_sections": [
                _section_preset("s2-call", 1, "call_to_worship", title="예배로 부름", role="인도자", duration_minutes=3),
                _section_preset("s2-confession", 2, "confession", title="신앙고백", role="다함께", duration_minutes=2),
                _section_preset("s2-antiphonal", 3, "antiphonal", title="성경교독", role="한절씩 교독", duration_minutes=3),
                _section_preset("s2-praise", 4, "song", title="경배와 찬양", role="찬양팀", duration_minutes=10),
                _section_preset("s2-prayer", 5, "prayer", title="회중기도", role="인도자", duration_minutes=5),
                _section_preset("s2-scripture", 6, "scripture", title="성경봉독", role="인도자", duration_minutes=4),
                _section_preset("s2-special-song", 7, "special_song", title="찬양", role="찬양팀", duration_minutes=5),
                _section_preset("s2-message", 8, "message", title="말씀", role="설교자", duration_minutes=25),
                _section_preset("s2-notice", 9, "notice", title="교회소식", role="인도자", duration_minutes=4),
                _section_preset("s2-hymn", 10, "song", title="찬송", role="찬양팀", duration_minutes=4),
                _section_preset("s2-offering", 11, "offering", title="헌금봉헌", role="다함께", duration_minutes=4),
                _section_preset("s2-hymn2", 12, "song", title="찬송", role="다함께", duration_minutes=2),
                _section_preset("s2-benediction", 13, "benediction", title="축도", role="담임목사", duration_minutes=2),
            ],
            "is_active": True,
        },
        {
            "id": "wtemplate-sunday-pm",
            "service_kind": "sundayPm",
            "display_name": "오후예배",
            "start_time": "14:00",
            "generation_rule": WorshipGenerationRule.sunday.value,
            "default_sections": [
                _section_preset("opening-song", 1, "song", title="찬양", role="찬양팀", duration_minutes=15),
                _section_preset("testimony", 2, "media", title="간증", role="미디어팀", duration_minutes=8),
                _section_preset("message", 3, "message", title="말씀", role="설교자", duration_minutes=30),
            ],
            "is_active": True,
        },
        {
            "id": "wtemplate-wednesday",
            "service_kind": "wednesday",
            "display_name": "수요 예배",
            "start_time": "19:30",
            "generation_rule": WorshipGenerationRule.wednesday.value,
            "default_sections": [
                _section_preset("opening-song", 1, "song", title="찬양", role="찬양팀", duration_minutes=10),
                _section_preset("scripture", 2, "scripture", title="본문", role="방송팀", duration_minutes=5),
                _section_preset("message", 3, "message", title="말씀", role="설교자", duration_minutes=25),
                _section_preset("prayer", 4, "prayer", title="합심기도", role="방송팀", duration_minutes=10),
            ],
            "is_active": True,
        },
        {
            "id": "wtemplate-friday",
            "service_kind": "friday",
            "display_name": "금요 기도회",
            "start_time": "20:30",
            "generation_rule": WorshipGenerationRule.friday.value,
            "default_sections": [
                _section_preset("opening-song", 1, "song", title="찬양", role="찬양팀", duration_minutes=18),
                _section_preset("message", 2, "message", title="말씀", role="설교자", duration_minutes=20),
                _section_preset("prayer", 3, "prayer", title="통성기도", role="방송팀", duration_minutes=15),
            ],
            "is_active": True,
        },
    ]


class WorshipRepository(Protocol):
    async def ensure_indexes(self) -> None: ...

    async def seed_defaults_if_empty(self) -> None: ...

    async def reset_service_state(self) -> None: ...

    async def list_templates(self, *, active_only: bool = False) -> list[dict[str, Any]]: ...

    async def get_template(self, template_id: str) -> dict[str, Any]: ...

    async def create_template(self, payload: dict[str, Any]) -> dict[str, Any]: ...

    async def update_template(self, template_id: str, payload: dict[str, Any]) -> dict[str, Any]: ...

    async def delete_template(self, template_id: str) -> None: ...

    async def list_section_types(self, *, active_only: bool = False) -> list[dict[str, Any]]: ...

    async def get_section_type(self, code: str) -> dict[str, Any]: ...

    async def create_section_type(self, payload: dict[str, Any]) -> dict[str, Any]: ...

    async def update_section_type(self, code: str, payload: dict[str, Any]) -> dict[str, Any]: ...

    async def delete_section_type(self, code: str) -> None: ...

    async def list_input_templates(self, *, active_only: bool = False) -> list[dict[str, Any]]: ...

    async def get_input_template(self, template_id: str) -> dict[str, Any]: ...

    async def create_input_template(self, payload: dict[str, Any]) -> dict[str, Any]: ...

    async def update_input_template(self, template_id: str, payload: dict[str, Any]) -> dict[str, Any]: ...

    async def delete_input_template(self, template_id: str) -> None: ...

    async def list_slide_templates(self, *, active_only: bool = False) -> list[dict[str, Any]]: ...

    async def get_slide_template(self, key: str) -> dict[str, Any]: ...

    async def create_slide_template(self, payload: dict[str, Any]) -> dict[str, Any]: ...

    async def update_slide_template(self, key: str, payload: dict[str, Any]) -> dict[str, Any]: ...

    async def delete_slide_template(self, key: str) -> None: ...

    async def list_services_between(self, start_date: str, end_date: str) -> list[dict[str, Any]]: ...

    async def list_services(self) -> list[dict[str, Any]]: ...

    async def get_service(self, service_id: str) -> dict[str, Any]: ...

    async def save_service(self, service: dict[str, Any]) -> dict[str, Any]: ...

    async def find_service_by_date_and_kind(self, target_date: str, service_kind: str) -> dict[str, Any] | None: ...

    async def get_presentation_state(self) -> dict[str, Any]: ...

    async def save_presentation_state(self, state: dict[str, Any]) -> dict[str, Any]: ...

    async def find_service_task_by_token_hash(self, token_hash: str) -> tuple[dict[str, Any], dict[str, Any]]: ...


def template_applies(template: dict[str, Any], target_date: date) -> bool:
    weekday = target_date.weekday()
    rule = template["generation_rule"]
    if rule == WorshipGenerationRule.daily.value:
        return True
    if rule == WorshipGenerationRule.sunday.value:
        return weekday == 6
    if rule == WorshipGenerationRule.wednesday.value:
        return weekday == 2
    if rule == WorshipGenerationRule.friday.value:
        return weekday == 4
    return False


class MongoWorshipRepository:
    def __init__(self, database: AsyncIOMotorDatabase):
        self.templates = database["worship_templates"]
        self.section_types = database["worship_section_types"]
        self.input_templates = database["worship_input_templates"]
        self.slide_templates = database["worship_slide_templates"]
        self.services = database["worship_services"]
        self.presentation_state = database["presentation_state"]
        self.config = database["worship_config"]

    async def ensure_indexes(self) -> None:
        await self.templates.create_index([("id", ASCENDING)], unique=True)
        await self.templates.create_index([("service_kind", ASCENDING)], unique=True)
        await self.templates.create_index([("is_active", ASCENDING)])
        await self.section_types.create_index([("code", ASCENDING)], unique=True)
        await self.section_types.create_index([("is_active", ASCENDING), ("sort_order", ASCENDING)])
        await self.input_templates.create_index([("id", ASCENDING)], unique=True)
        await self.input_templates.create_index([("is_active", ASCENDING)])
        await self.slide_templates.create_index([("key", ASCENDING)], unique=True)
        await self.slide_templates.create_index([("is_active", ASCENDING)])
        await self.services.create_index([("id", ASCENDING)], unique=True)
        await self.services.create_index([("date", ASCENDING), ("service_kind", ASCENDING)], unique=True)
        await self.services.create_index([("tasks.guest_access.token_hash", ASCENDING)])
        await self.presentation_state.create_index([("id", ASCENDING)], unique=True)
        await self.config.create_index([("id", ASCENDING)], unique=True)

    async def _ensure_admin_seeded(self) -> None:
        version_row = await self.config.find_one({"id": "admin-schema"}, {"_id": False})
        current_version = int(version_row.get("version", 0)) if version_row else 0
        if current_version == WORSHIP_ADMIN_SCHEMA_VERSION and await self.templates.count_documents({}) > 0:
            return
        now = iso_now()
        await self.templates.delete_many({})
        await self.section_types.delete_many({})
        await self.input_templates.delete_many({})
        await self.slide_templates.delete_many({})
        await self.templates.insert_many([{**item, "created_at": now, "updated_at": now} for item in default_worship_templates()])
        await self.section_types.insert_many(default_section_type_definitions())
        await self.input_templates.insert_many([{**item, "created_at": now, "updated_at": now} for item in default_input_templates()])
        await self.slide_templates.insert_many([{**item, "created_at": now, "updated_at": now} for item in default_slide_templates()])
        await self.config.replace_one(
            {"id": "admin-schema"},
            {"id": "admin-schema", "version": WORSHIP_ADMIN_SCHEMA_VERSION, "updated_at": now},
            upsert=True,
        )

    async def seed_defaults_if_empty(self) -> None:
        await self._ensure_admin_seeded()
        if await self.presentation_state.count_documents({}) == 0:
            await self.presentation_state.insert_one({"id": "default", **default_presentation_state()})

    async def reset_service_state(self) -> None:
        await self.services.delete_many({})
        await self.presentation_state.delete_many({})

    async def list_templates(self, *, active_only: bool = False) -> list[dict[str, Any]]:
        query = {"is_active": True} if active_only else {}
        return await self.templates.find(query, {"_id": False}).sort("service_kind", ASCENDING).to_list(None)

    async def get_template(self, template_id: str) -> dict[str, Any]:
        row = await self.templates.find_one({"id": template_id}, {"_id": False})
        if row is None:
            raise NotFoundError(f"Worship template '{template_id}' was not found.")
        return row

    async def create_template(self, payload: dict[str, Any]) -> dict[str, Any]:
        now = iso_now()
        if await self.templates.find_one({"service_kind": payload["service_kind"]}, {"_id": False}) is not None:
            raise ConflictError(f"Service kind '{payload['service_kind']}' already exists.")
        template = {"id": payload.get("id") or new_id("wtemplate"), **payload, "created_at": now, "updated_at": now}
        await self.templates.insert_one(template)
        return _clone(template)

    async def update_template(self, template_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        current = await self.get_template(template_id)
        if "service_kind" in payload and payload["service_kind"] != current["service_kind"]:
            duplicate = await self.templates.find_one({"service_kind": payload["service_kind"]}, {"_id": False})
            if duplicate is not None and duplicate["id"] != template_id:
                raise ConflictError(f"Service kind '{payload['service_kind']}' already exists.")
        updated = await self.templates.find_one_and_update(
            {"id": template_id},
            {"$set": {**payload, "updated_at": iso_now()}},
            projection={"_id": False},
            return_document=ReturnDocument.AFTER,
        )
        if updated is None:
            raise NotFoundError(f"Worship template '{template_id}' was not found.")
        return updated

    async def delete_template(self, template_id: str) -> None:
        deleted = await self.templates.find_one_and_delete({"id": template_id}, {"_id": False})
        if deleted is None:
            raise NotFoundError(f"Worship template '{template_id}' was not found.")

    async def list_section_types(self, *, active_only: bool = False) -> list[dict[str, Any]]:
        query = {"is_active": True} if active_only else {}
        return await self.section_types.find(query, {"_id": False}).sort([("sort_order", ASCENDING), ("label", ASCENDING)]).to_list(None)

    async def get_section_type(self, code: str) -> dict[str, Any]:
        row = await self.section_types.find_one({"code": code}, {"_id": False})
        if row is None:
            raise NotFoundError(f"Section type '{code}' was not found.")
        return row

    async def create_section_type(self, payload: dict[str, Any]) -> dict[str, Any]:
        if await self.section_types.find_one({"code": payload["code"]}, {"_id": False}) is not None:
            raise ConflictError(f"Section type '{payload['code']}' already exists.")
        await self.section_types.insert_one(payload)
        return _clone(payload)

    async def update_section_type(self, code: str, payload: dict[str, Any]) -> dict[str, Any]:
        if "code" in payload and payload["code"] != code:
            duplicate = await self.section_types.find_one({"code": payload["code"]}, {"_id": False})
            if duplicate is not None and duplicate["code"] != code:
                raise ConflictError(f"Section type '{payload['code']}' already exists.")
        updated = await self.section_types.find_one_and_update(
            {"code": code},
            {"$set": payload},
            projection={"_id": False},
            return_document=ReturnDocument.AFTER,
        )
        if updated is None:
            raise NotFoundError(f"Section type '{code}' was not found.")
        return updated

    async def delete_section_type(self, code: str) -> None:
        deleted = await self.section_types.find_one_and_delete({"code": code}, {"_id": False})
        if deleted is None:
            raise NotFoundError(f"Section type '{code}' was not found.")

    async def list_input_templates(self, *, active_only: bool = False) -> list[dict[str, Any]]:
        query = {"is_active": True} if active_only else {}
        return await self.input_templates.find(query, {"_id": False}).sort("label", ASCENDING).to_list(None)

    async def get_input_template(self, template_id: str) -> dict[str, Any]:
        row = await self.input_templates.find_one({"id": template_id}, {"_id": False})
        if row is None:
            raise NotFoundError(f"Input template '{template_id}' was not found.")
        return row

    async def create_input_template(self, payload: dict[str, Any]) -> dict[str, Any]:
        now = iso_now()
        if await self.input_templates.find_one({"id": payload["id"]}, {"_id": False}) is not None:
            raise ConflictError(f"Input template '{payload['id']}' already exists.")
        row = {**payload, "created_at": now, "updated_at": now}
        await self.input_templates.insert_one(row)
        return _clone(row)

    async def update_input_template(self, template_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        if "id" in payload and payload["id"] != template_id:
            duplicate = await self.input_templates.find_one({"id": payload["id"]}, {"_id": False})
            if duplicate is not None and duplicate["id"] != template_id:
                raise ConflictError(f"Input template '{payload['id']}' already exists.")
        updated = await self.input_templates.find_one_and_update(
            {"id": template_id},
            {"$set": {**payload, "updated_at": iso_now()}},
            projection={"_id": False},
            return_document=ReturnDocument.AFTER,
        )
        if updated is None:
            raise NotFoundError(f"Input template '{template_id}' was not found.")
        return updated

    async def delete_input_template(self, template_id: str) -> None:
        deleted = await self.input_templates.find_one_and_delete({"id": template_id}, {"_id": False})
        if deleted is None:
            raise NotFoundError(f"Input template '{template_id}' was not found.")

    async def list_slide_templates(self, *, active_only: bool = False) -> list[dict[str, Any]]:
        query = {"is_active": True} if active_only else {}
        return await self.slide_templates.find(query, {"_id": False}).sort("label", ASCENDING).to_list(None)

    async def get_slide_template(self, key: str) -> dict[str, Any]:
        row = await self.slide_templates.find_one({"key": key}, {"_id": False})
        if row is None:
            raise NotFoundError(f"Slide template '{key}' was not found.")
        return row

    async def create_slide_template(self, payload: dict[str, Any]) -> dict[str, Any]:
        now = iso_now()
        if await self.slide_templates.find_one({"key": payload["key"]}, {"_id": False}) is not None:
            raise ConflictError(f"Slide template '{payload['key']}' already exists.")
        row = {**payload, "created_at": now, "updated_at": now}
        await self.slide_templates.insert_one(row)
        return _clone(row)

    async def update_slide_template(self, key: str, payload: dict[str, Any]) -> dict[str, Any]:
        if "key" in payload and payload["key"] != key:
            duplicate = await self.slide_templates.find_one({"key": payload["key"]}, {"_id": False})
            if duplicate is not None and duplicate["key"] != key:
                raise ConflictError(f"Slide template '{payload['key']}' already exists.")
        updated = await self.slide_templates.find_one_and_update(
            {"key": key},
            {"$set": {**payload, "updated_at": iso_now()}},
            projection={"_id": False},
            return_document=ReturnDocument.AFTER,
        )
        if updated is None:
            raise NotFoundError(f"Slide template '{key}' was not found.")
        return updated

    async def delete_slide_template(self, key: str) -> None:
        deleted = await self.slide_templates.find_one_and_delete({"key": key}, {"_id": False})
        if deleted is None:
            raise NotFoundError(f"Slide template '{key}' was not found.")

    async def list_services_between(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        return (
            await self.services.find({"date": {"$gte": start_date, "$lte": end_date}}, {"_id": False})
            .sort([("date", ASCENDING), ("start_at", ASCENDING)])
            .to_list(None)
        )

    async def list_services(self) -> list[dict[str, Any]]:
        return await self.services.find({}, {"_id": False}).sort([("date", ASCENDING), ("start_at", ASCENDING)]).to_list(None)

    async def get_service(self, service_id: str) -> dict[str, Any]:
        row = await self.services.find_one({"id": service_id}, {"_id": False})
        if row is None:
            raise NotFoundError(f"Worship service '{service_id}' was not found.")
        return row

    async def save_service(self, service: dict[str, Any]) -> dict[str, Any]:
        await self.services.replace_one({"id": service["id"]}, service, upsert=True)
        return _clone(service)

    async def find_service_by_date_and_kind(self, target_date: str, service_kind: str) -> dict[str, Any] | None:
        return await self.services.find_one({"date": target_date, "service_kind": service_kind}, {"_id": False})

    async def get_presentation_state(self) -> dict[str, Any]:
        row = await self.presentation_state.find_one({"id": "default"}, {"_id": False})
        if row is None:
            row = {"id": "default", **default_presentation_state()}
            await self.presentation_state.insert_one(row)
        row.pop("id", None)
        return row

    async def save_presentation_state(self, state: dict[str, Any]) -> dict[str, Any]:
        payload = {"id": "default", **state}
        await self.presentation_state.replace_one({"id": "default"}, payload, upsert=True)
        payload.pop("id", None)
        return payload

    async def find_service_task_by_token_hash(self, token_hash: str) -> tuple[dict[str, Any], dict[str, Any]]:
        row = await self.services.find_one({"tasks.guest_access.token_hash": token_hash}, {"_id": False})
        if row is None:
            raise NotFoundError("Guest input was not found.")
        task = next((item for item in row.get("tasks", []) if item.get("guest_access", {}).get("token_hash") == token_hash), None)
        if task is None:
            raise NotFoundError("Guest input was not found.")
        return row, task


class InMemoryWorshipRepository:
    def __init__(self) -> None:
        self.templates: dict[str, dict[str, Any]] = {}
        self.section_types: dict[str, dict[str, Any]] = {}
        self.input_templates: dict[str, dict[str, Any]] = {}
        self.slide_templates: dict[str, dict[str, Any]] = {}
        self.services: dict[str, dict[str, Any]] = {}
        self.presentation: dict[str, Any] = default_presentation_state()
        self.admin_schema_version = 0

    @classmethod
    def bootstrap(cls) -> "InMemoryWorshipRepository":
        repo = cls()
        repo._reset_admin_state()
        return repo

    def _reset_admin_state(self) -> None:
        now = iso_now()
        self.templates = {item["id"]: {**item, "created_at": now, "updated_at": now} for item in default_worship_templates()}
        self.section_types = {item["code"]: _clone(item) for item in default_section_type_definitions()}
        self.input_templates = {item["id"]: {**item, "created_at": now, "updated_at": now} for item in default_input_templates()}
        self.slide_templates = {item["key"]: {**item, "created_at": now, "updated_at": now} for item in default_slide_templates()}
        self.admin_schema_version = WORSHIP_ADMIN_SCHEMA_VERSION

    async def ensure_indexes(self) -> None:
        return None

    async def seed_defaults_if_empty(self) -> None:
        if self.admin_schema_version != WORSHIP_ADMIN_SCHEMA_VERSION or not self.templates:
            self._reset_admin_state()

    async def reset_service_state(self) -> None:
        self.services.clear()
        self.presentation = default_presentation_state()

    async def list_templates(self, *, active_only: bool = False) -> list[dict[str, Any]]:
        rows = list(self.templates.values())
        if active_only:
            rows = [row for row in rows if row["is_active"]]
        rows.sort(key=lambda row: row["service_kind"])
        return [_clone(row) for row in rows]

    async def get_template(self, template_id: str) -> dict[str, Any]:
        row = self.templates.get(template_id)
        if row is None:
            raise NotFoundError(f"Worship template '{template_id}' was not found.")
        return _clone(row)

    async def create_template(self, payload: dict[str, Any]) -> dict[str, Any]:
        now = iso_now()
        if any(item["service_kind"] == payload["service_kind"] for item in self.templates.values()):
            raise ConflictError(f"Service kind '{payload['service_kind']}' already exists.")
        row = {"id": payload.get("id") or new_id("wtemplate"), **payload, "created_at": now, "updated_at": now}
        self.templates[row["id"]] = row
        return _clone(row)

    async def update_template(self, template_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        current = self.templates.get(template_id)
        if current is None:
            raise NotFoundError(f"Worship template '{template_id}' was not found.")
        if "service_kind" in payload:
            if any(item["service_kind"] == payload["service_kind"] and item["id"] != template_id for item in self.templates.values()):
                raise ConflictError(f"Service kind '{payload['service_kind']}' already exists.")
        current.update({**payload, "updated_at": iso_now()})
        return _clone(current)

    async def delete_template(self, template_id: str) -> None:
        if template_id not in self.templates:
            raise NotFoundError(f"Worship template '{template_id}' was not found.")
        del self.templates[template_id]

    async def list_section_types(self, *, active_only: bool = False) -> list[dict[str, Any]]:
        rows = list(self.section_types.values())
        if active_only:
            rows = [row for row in rows if row["is_active"]]
        rows.sort(key=lambda row: (row["sort_order"], row["label"]))
        return [_clone(row) for row in rows]

    async def get_section_type(self, code: str) -> dict[str, Any]:
        row = self.section_types.get(code)
        if row is None:
            raise NotFoundError(f"Section type '{code}' was not found.")
        return _clone(row)

    async def create_section_type(self, payload: dict[str, Any]) -> dict[str, Any]:
        if payload["code"] in self.section_types:
            raise ConflictError(f"Section type '{payload['code']}' already exists.")
        self.section_types[payload["code"]] = _clone(payload)
        return _clone(payload)

    async def update_section_type(self, code: str, payload: dict[str, Any]) -> dict[str, Any]:
        current = self.section_types.get(code)
        if current is None:
            raise NotFoundError(f"Section type '{code}' was not found.")
        if "code" in payload and payload["code"] != code and payload["code"] in self.section_types:
            raise ConflictError(f"Section type '{payload['code']}' already exists.")
        next_code = payload.get("code", code)
        current.update(payload)
        if next_code != code:
            del self.section_types[code]
            self.section_types[next_code] = current
        return _clone(current)

    async def delete_section_type(self, code: str) -> None:
        if code not in self.section_types:
            raise NotFoundError(f"Section type '{code}' was not found.")
        del self.section_types[code]

    async def list_input_templates(self, *, active_only: bool = False) -> list[dict[str, Any]]:
        rows = list(self.input_templates.values())
        if active_only:
            rows = [row for row in rows if row["is_active"]]
        rows.sort(key=lambda row: row["label"])
        return [_clone(row) for row in rows]

    async def get_input_template(self, template_id: str) -> dict[str, Any]:
        row = self.input_templates.get(template_id)
        if row is None:
            raise NotFoundError(f"Input template '{template_id}' was not found.")
        return _clone(row)

    async def create_input_template(self, payload: dict[str, Any]) -> dict[str, Any]:
        now = iso_now()
        if payload["id"] in self.input_templates:
            raise ConflictError(f"Input template '{payload['id']}' already exists.")
        row = {**payload, "created_at": now, "updated_at": now}
        self.input_templates[row["id"]] = row
        return _clone(row)

    async def update_input_template(self, template_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        current = self.input_templates.get(template_id)
        if current is None:
            raise NotFoundError(f"Input template '{template_id}' was not found.")
        next_id = payload.get("id", template_id)
        if next_id != template_id and next_id in self.input_templates:
            raise ConflictError(f"Input template '{next_id}' already exists.")
        current.update({**payload, "updated_at": iso_now()})
        if next_id != template_id:
            del self.input_templates[template_id]
            self.input_templates[next_id] = current
        return _clone(current)

    async def delete_input_template(self, template_id: str) -> None:
        if template_id not in self.input_templates:
            raise NotFoundError(f"Input template '{template_id}' was not found.")
        del self.input_templates[template_id]

    async def list_slide_templates(self, *, active_only: bool = False) -> list[dict[str, Any]]:
        rows = list(self.slide_templates.values())
        if active_only:
            rows = [row for row in rows if row["is_active"]]
        rows.sort(key=lambda row: row["label"])
        return [_clone(row) for row in rows]

    async def get_slide_template(self, key: str) -> dict[str, Any]:
        row = self.slide_templates.get(key)
        if row is None:
            raise NotFoundError(f"Slide template '{key}' was not found.")
        return _clone(row)

    async def create_slide_template(self, payload: dict[str, Any]) -> dict[str, Any]:
        now = iso_now()
        if payload["key"] in self.slide_templates:
            raise ConflictError(f"Slide template '{payload['key']}' already exists.")
        row = {**payload, "created_at": now, "updated_at": now}
        self.slide_templates[row["key"]] = row
        return _clone(row)

    async def update_slide_template(self, key: str, payload: dict[str, Any]) -> dict[str, Any]:
        current = self.slide_templates.get(key)
        if current is None:
            raise NotFoundError(f"Slide template '{key}' was not found.")
        next_key = payload.get("key", key)
        if next_key != key and next_key in self.slide_templates:
            raise ConflictError(f"Slide template '{next_key}' already exists.")
        current.update({**payload, "updated_at": iso_now()})
        if next_key != key:
            del self.slide_templates[key]
            self.slide_templates[next_key] = current
        return _clone(current)

    async def delete_slide_template(self, key: str) -> None:
        if key not in self.slide_templates:
            raise NotFoundError(f"Slide template '{key}' was not found.")
        del self.slide_templates[key]

    async def list_services_between(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        rows = [row for row in self.services.values() if start_date <= row["date"] <= end_date]
        rows.sort(key=lambda row: (row["date"], row["start_at"]))
        return [_clone(row) for row in rows]

    async def list_services(self) -> list[dict[str, Any]]:
        rows = list(self.services.values())
        rows.sort(key=lambda row: (row["date"], row["start_at"]))
        return [_clone(row) for row in rows]

    async def get_service(self, service_id: str) -> dict[str, Any]:
        row = self.services.get(service_id)
        if row is None:
            raise NotFoundError(f"Worship service '{service_id}' was not found.")
        return _clone(row)

    async def save_service(self, service: dict[str, Any]) -> dict[str, Any]:
        self.services[service["id"]] = _clone(service)
        return _clone(service)

    async def find_service_by_date_and_kind(self, target_date: str, service_kind: str) -> dict[str, Any] | None:
        for service in self.services.values():
            if service["date"] == target_date and service["service_kind"] == service_kind:
                return _clone(service)
        return None

    async def get_presentation_state(self) -> dict[str, Any]:
        return _clone(self.presentation)

    async def save_presentation_state(self, state: dict[str, Any]) -> dict[str, Any]:
        self.presentation = _clone(state)
        return _clone(self.presentation)

    async def find_service_task_by_token_hash(self, token_hash: str) -> tuple[dict[str, Any], dict[str, Any]]:
        for service in self.services.values():
            for task in service.get("tasks", []):
                if task.get("guest_access", {}).get("token_hash") == token_hash:
                    return _clone(service), _clone(task)
        raise NotFoundError("Guest input was not found.")
