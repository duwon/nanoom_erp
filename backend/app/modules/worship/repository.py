from __future__ import annotations

from copy import deepcopy
from datetime import date, datetime, timezone
from typing import Any, Protocol

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, ReturnDocument

from app.core.store import ConflictError, NotFoundError, iso_now, new_id
from app.modules.worship.schemas import (
    WorshipFieldType,
    WorshipGenerationRule,
    WorshipPresentationState,
    WorshipSectionType,
)


def _clone(value: Any) -> Any:
    return deepcopy(value)


def _template_presets() -> list[dict[str, Any]]:
    return [
        {"key": "lyrics-16x9", "label": "가사 16:9", "description": "송출용 가사 템플릿"},
        {"key": "scripture-main", "label": "말씀 본문", "description": "본문 자막 템플릿"},
        {"key": "message-notes", "label": "설교 포인트", "description": "강단 메모 템플릿"},
        {"key": "notice-card", "label": "공지 카드", "description": "공지/광고 슬라이드 템플릿"},
    ]


def _section_preset(
    section_id: str,
    order: int,
    section_type: str,
    title: str,
    *,
    role: str = "",
    detail: str = "",
    duration_minutes: int = 0,
    template_key: str = "",
    notes: str = "",
    content: dict[str, Any] | None = None,
    assignee_name: str | None = None,
) -> dict[str, Any]:
    return {
        "id": section_id,
        "order": order,
        "section_type": section_type,
        "title": title,
        "detail": detail,
        "role": role,
        "assignee_name": assignee_name,
        "duration_minutes": duration_minutes,
        "template_key": template_key,
        "notes": notes,
        "content": content or {},
    }


def _field_spec(key: str, label: str, field_type: str, *, required: bool = True, help_text: str = "") -> dict[str, Any]:
    return {
        "key": key,
        "label": label,
        "field_type": field_type,
        "required": required,
        "help_text": help_text,
    }


def _task_preset(
    task_id: str,
    role: str,
    *,
    scope: str,
    section_ids: list[str],
    due_offset_minutes: int,
    tips: str,
    required_fields: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "id": task_id,
        "role": role,
        "scope": scope,
        "section_ids": section_ids,
        "required_fields": required_fields,
        "due_offset_minutes": due_offset_minutes,
        "tips": tips,
    }


def default_presentation_state() -> dict[str, Any]:
    return WorshipPresentationState(
        title="송출 대기 중",
        content="예배 검수 화면에서 송출할 섹션을 선택해 주세요.",
        updated_at=None,
    ).model_dump()


class WorshipRepository(Protocol):
    async def ensure_indexes(self) -> None: ...

    async def seed_defaults_if_empty(self) -> None: ...

    async def list_templates(self, *, active_only: bool = False) -> list[dict[str, Any]]: ...

    async def get_template(self, template_id: str) -> dict[str, Any]: ...

    async def create_template(self, payload: dict[str, Any]) -> dict[str, Any]: ...

    async def update_template(self, template_id: str, payload: dict[str, Any]) -> dict[str, Any]: ...

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


def default_worship_templates() -> list[dict[str, Any]]:
    return [
        {
            "id": "wtemplate-dawn",
            "service_kind": "dawn",
            "display_name": "새벽기도",
            "start_time": "05:30",
            "generation_rule": WorshipGenerationRule.daily.value,
            "default_sections": [
                _section_preset("opening-song", 1, WorshipSectionType.song.value, "찬양", role="찬양팀", duration_minutes=10, template_key="lyrics-16x9"),
                _section_preset("scripture", 2, WorshipSectionType.scripture.value, "성경 본문", role="말씀 담당", duration_minutes=5, template_key="scripture-main"),
                _section_preset("message", 3, WorshipSectionType.message.value, "말씀", role="설교자", duration_minutes=20, template_key="message-notes"),
                _section_preset("prayer", 4, WorshipSectionType.prayer.value, "기도", role="인도자", duration_minutes=5),
            ],
            "task_presets": [
                _task_preset(
                    "task-praise",
                    "찬양팀",
                    scope="찬양 가사 입력",
                    section_ids=["opening-song"],
                    due_offset_minutes=120,
                    tips="곡 제목과 가사를 붙여넣으면 자동 분할을 사용할 수 있습니다.",
                    required_fields=[
                        _field_spec("songTitle", "곡 제목", WorshipFieldType.song_search.value),
                        _field_spec("lyrics", "가사", WorshipFieldType.lyrics.value),
                    ],
                ),
                _task_preset(
                    "task-scripture",
                    "말씀 담당",
                    scope="본문 선택",
                    section_ids=["scripture"],
                    due_offset_minutes=90,
                    tips="장절과 템플릿을 선택하세요.",
                    required_fields=[
                        _field_spec("reference", "본문", WorshipFieldType.scripture.value),
                        _field_spec("templateKey", "템플릿", WorshipFieldType.template.value),
                    ],
                ),
            ],
            "template_presets": _template_presets(),
            "is_active": True,
        },
        {
            "id": "wtemplate-sunday1",
            "service_kind": "sunday1",
            "display_name": "주일 1부 예배",
            "start_time": "07:00",
            "generation_rule": WorshipGenerationRule.sunday.value,
            "default_sections": [
                _section_preset("opening-song", 1, WorshipSectionType.song.value, "경배와 찬양", role="찬양팀", duration_minutes=12, template_key="lyrics-16x9"),
                _section_preset("hymn", 2, WorshipSectionType.song.value, "찬송", role="찬양팀", duration_minutes=5, template_key="lyrics-16x9"),
                _section_preset("scripture", 3, WorshipSectionType.scripture.value, "성경 봉독", role="말씀 담당", duration_minutes=5, template_key="scripture-main"),
                _section_preset("message", 4, WorshipSectionType.message.value, "말씀", role="설교자", duration_minutes=25, template_key="message-notes"),
                _section_preset("notice", 5, WorshipSectionType.notice.value, "공지", role="미디어팀", duration_minutes=4, template_key="notice-card"),
            ],
            "task_presets": [
                _task_preset(
                    "task-praise",
                    "찬양팀",
                    scope="경배와 찬양, 찬송",
                    section_ids=["opening-song", "hymn"],
                    due_offset_minutes=180,
                    tips="가사는 붙여넣고, 후렴 반복은 자동 분할로 확인하세요.",
                    required_fields=[
                        _field_spec("songTitle", "곡 제목", WorshipFieldType.song_search.value),
                        _field_spec("lyrics", "가사", WorshipFieldType.lyrics.value),
                    ],
                ),
                _task_preset(
                    "task-message",
                    "말씀 담당",
                    scope="본문과 설교 포인트",
                    section_ids=["scripture", "message"],
                    due_offset_minutes=120,
                    tips="본문 자동 불러오기 후 설교 포인트를 정리하세요.",
                    required_fields=[
                        _field_spec("reference", "본문", WorshipFieldType.scripture.value),
                        _field_spec("notes", "설교 포인트", WorshipFieldType.textarea.value, required=False),
                        _field_spec("templateKey", "템플릿", WorshipFieldType.template.value),
                    ],
                ),
                _task_preset(
                    "task-media",
                    "미디어팀",
                    scope="공지 카드와 최종 송출",
                    section_ids=["notice"],
                    due_offset_minutes=90,
                    tips="공지 카드는 간단한 문장과 템플릿만 입력하세요.",
                    required_fields=[
                        _field_spec("noticeTitle", "공지 제목", WorshipFieldType.text.value),
                        _field_spec("noticeBody", "공지 내용", WorshipFieldType.textarea.value),
                    ],
                ),
            ],
            "template_presets": _template_presets(),
            "is_active": True,
        },
        {
            "id": "wtemplate-sunday2",
            "service_kind": "sunday2",
            "display_name": "주일 2부 예배",
            "start_time": "11:00",
            "generation_rule": WorshipGenerationRule.sunday.value,
            "default_sections": [
                _section_preset("opening-song", 1, WorshipSectionType.song.value, "경배와 찬양", role="찬양팀", duration_minutes=15, template_key="lyrics-16x9"),
                _section_preset("special-song", 2, WorshipSectionType.special_song.value, "특송", role="특송팀", duration_minutes=5, template_key="lyrics-16x9"),
                _section_preset("scripture", 3, WorshipSectionType.scripture.value, "성경 봉독", role="말씀 담당", duration_minutes=5, template_key="scripture-main"),
                _section_preset("message", 4, WorshipSectionType.message.value, "말씀", role="설교자", duration_minutes=30, template_key="message-notes"),
                _section_preset("notice", 5, WorshipSectionType.notice.value, "광고", role="미디어팀", duration_minutes=5, template_key="notice-card"),
            ],
            "task_presets": [
                _task_preset(
                    "task-praise",
                    "찬양팀",
                    scope="경배와 찬양",
                    section_ids=["opening-song"],
                    due_offset_minutes=180,
                    tips="곡 제목과 가사를 입력하세요.",
                    required_fields=[
                        _field_spec("songTitle", "곡 제목", WorshipFieldType.song_search.value),
                        _field_spec("lyrics", "가사", WorshipFieldType.lyrics.value),
                    ],
                ),
                _task_preset(
                    "task-special",
                    "특송팀",
                    scope="특송 제목과 가사",
                    section_ids=["special-song"],
                    due_offset_minutes=150,
                    tips="모바일 링크로 제목과 가사만 빠르게 입력합니다.",
                    required_fields=[
                        _field_spec("title", "특송 제목", WorshipFieldType.text.value),
                        _field_spec("lyrics", "가사", WorshipFieldType.lyrics.value),
                    ],
                ),
                _task_preset(
                    "task-message",
                    "말씀 담당",
                    scope="본문과 설교 포인트",
                    section_ids=["scripture", "message"],
                    due_offset_minutes=120,
                    tips="본문과 메시지 포인트를 정리하세요.",
                    required_fields=[
                        _field_spec("reference", "본문", WorshipFieldType.scripture.value),
                        _field_spec("notes", "설교 포인트", WorshipFieldType.textarea.value, required=False),
                    ],
                ),
            ],
            "template_presets": _template_presets(),
            "is_active": True,
        },
        {
            "id": "wtemplate-sunday-pm",
            "service_kind": "sundayPm",
            "display_name": "오후예배",
            "start_time": "14:00",
            "generation_rule": WorshipGenerationRule.sunday.value,
            "default_sections": [
                _section_preset("opening-song", 1, WorshipSectionType.song.value, "찬양", role="찬양팀", duration_minutes=15, template_key="lyrics-16x9"),
                _section_preset("testimony", 2, WorshipSectionType.media.value, "간증", role="미디어팀", duration_minutes=8, template_key="notice-card"),
                _section_preset("message", 3, WorshipSectionType.message.value, "말씀", role="설교자", duration_minutes=30, template_key="message-notes"),
            ],
            "task_presets": [
                _task_preset(
                    "task-praise",
                    "찬양팀",
                    scope="오후예배 찬양",
                    section_ids=["opening-song"],
                    due_offset_minutes=180,
                    tips="가사를 미리 분할합니다.",
                    required_fields=[
                        _field_spec("songTitle", "곡 제목", WorshipFieldType.song_search.value),
                        _field_spec("lyrics", "가사", WorshipFieldType.lyrics.value),
                    ],
                ),
                _task_preset(
                    "task-media",
                    "미디어팀",
                    scope="간증/영상",
                    section_ids=["testimony"],
                    due_offset_minutes=120,
                    tips="간증 제목과 메모를 입력합니다.",
                    required_fields=[
                        _field_spec("title", "제목", WorshipFieldType.text.value),
                        _field_spec("notes", "메모", WorshipFieldType.textarea.value, required=False),
                    ],
                ),
            ],
            "template_presets": _template_presets(),
            "is_active": True,
        },
        {
            "id": "wtemplate-wednesday",
            "service_kind": "wednesday",
            "display_name": "수요 예배",
            "start_time": "19:30",
            "generation_rule": WorshipGenerationRule.wednesday.value,
            "default_sections": [
                _section_preset("opening-song", 1, WorshipSectionType.song.value, "찬양", role="찬양팀", duration_minutes=10, template_key="lyrics-16x9"),
                _section_preset("scripture", 2, WorshipSectionType.scripture.value, "본문", role="말씀 담당", duration_minutes=5, template_key="scripture-main"),
                _section_preset("message", 3, WorshipSectionType.message.value, "말씀", role="설교자", duration_minutes=25, template_key="message-notes"),
                _section_preset("prayer", 4, WorshipSectionType.prayer.value, "합심기도", role="인도자", duration_minutes=10),
            ],
            "task_presets": [
                _task_preset(
                    "task-message",
                    "말씀 담당",
                    scope="본문/말씀",
                    section_ids=["scripture", "message"],
                    due_offset_minutes=120,
                    tips="본문과 메시지를 확인합니다.",
                    required_fields=[
                        _field_spec("reference", "본문", WorshipFieldType.scripture.value),
                        _field_spec("notes", "메시지 메모", WorshipFieldType.textarea.value, required=False),
                    ],
                ),
            ],
            "template_presets": _template_presets(),
            "is_active": True,
        },
        {
            "id": "wtemplate-friday",
            "service_kind": "friday",
            "display_name": "금요 기도회",
            "start_time": "20:30",
            "generation_rule": WorshipGenerationRule.friday.value,
            "default_sections": [
                _section_preset("opening-song", 1, WorshipSectionType.song.value, "찬양", role="찬양팀", duration_minutes=18, template_key="lyrics-16x9"),
                _section_preset("message", 2, WorshipSectionType.message.value, "말씀", role="설교자", duration_minutes=20, template_key="message-notes"),
                _section_preset("prayer", 3, WorshipSectionType.prayer.value, "통성기도", role="인도자", duration_minutes=15),
            ],
            "task_presets": [
                _task_preset(
                    "task-praise",
                    "찬양팀",
                    scope="금요 찬양",
                    section_ids=["opening-song"],
                    due_offset_minutes=180,
                    tips="찬양 가사를 입력합니다.",
                    required_fields=[
                        _field_spec("songTitle", "곡 제목", WorshipFieldType.song_search.value),
                        _field_spec("lyrics", "가사", WorshipFieldType.lyrics.value),
                    ],
                ),
            ],
            "template_presets": _template_presets(),
            "is_active": True,
        },
    ]


class MongoWorshipRepository:
    def __init__(self, database: AsyncIOMotorDatabase):
        self.templates = database["worship_templates"]
        self.services = database["worship_services"]
        self.presentation_state = database["presentation_state"]

    async def ensure_indexes(self) -> None:
        await self.templates.create_index([("id", ASCENDING)], unique=True)
        await self.templates.create_index([("service_kind", ASCENDING)], unique=True)
        await self.templates.create_index([("is_active", ASCENDING)])
        await self.services.create_index([("id", ASCENDING)], unique=True)
        await self.services.create_index([("date", ASCENDING), ("service_kind", ASCENDING)], unique=True)
        await self.services.create_index([("tasks.guest_access.token_hash", ASCENDING)])
        await self.presentation_state.create_index([("id", ASCENDING)], unique=True)

    async def seed_defaults_if_empty(self) -> None:
        if await self.templates.count_documents({}) == 0:
            now = iso_now()
            await self.templates.insert_many(
                [{**template, "created_at": now, "updated_at": now} for template in default_worship_templates()]
            )
        if await self.presentation_state.count_documents({}) == 0:
            await self.presentation_state.insert_one({"id": "default", **default_presentation_state()})

    async def list_templates(self, *, active_only: bool = False) -> list[dict[str, Any]]:
        query = {"is_active": True} if active_only else {}
        rows = await self.templates.find(query, {"_id": False}).sort("service_kind", ASCENDING).to_list(None)
        return rows

    async def get_template(self, template_id: str) -> dict[str, Any]:
        row = await self.templates.find_one({"id": template_id}, {"_id": False})
        if row is None:
            raise NotFoundError(f"Worship template '{template_id}' was not found.")
        return row

    async def create_template(self, payload: dict[str, Any]) -> dict[str, Any]:
        now = iso_now()
        if await self.templates.find_one({"service_kind": payload["service_kind"]}, {"_id": False}) is not None:
            raise ConflictError(f"Service kind '{payload['service_kind']}' already exists.")
        template = {
            "id": payload.get("id") or new_id("wtemplate"),
            **payload,
            "created_at": now,
            "updated_at": now,
        }
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

    async def list_services_between(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        rows = (
            await self.services.find({"date": {"$gte": start_date, "$lte": end_date}}, {"_id": False})
            .sort([("date", ASCENDING), ("start_at", ASCENDING)])
            .to_list(None)
        )
        return rows

    async def list_services(self) -> list[dict[str, Any]]:
        rows = await self.services.find({}, {"_id": False}).sort([("date", ASCENDING), ("start_at", ASCENDING)]).to_list(None)
        return rows

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
        task = next(
            (item for item in row.get("tasks", []) if item.get("guest_access", {}).get("token_hash") == token_hash),
            None,
        )
        if task is None:
            raise NotFoundError("Guest input was not found.")
        return row, task


class InMemoryWorshipRepository:
    def __init__(self) -> None:
        self.templates: dict[str, dict[str, Any]] = {}
        self.services: dict[str, dict[str, Any]] = {}
        self.presentation: dict[str, Any] = default_presentation_state()

    @classmethod
    def bootstrap(cls) -> "InMemoryWorshipRepository":
        repo = cls()
        now = iso_now()
        for template in default_worship_templates():
            repo.templates[template["id"]] = {**template, "created_at": now, "updated_at": now}
        return repo

    async def ensure_indexes(self) -> None:
        return None

    async def seed_defaults_if_empty(self) -> None:
        if self.templates:
            return
        seeded = self.bootstrap()
        self.templates = seeded.templates
        self.presentation = seeded.presentation

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
        template = {
            "id": payload.get("id") or new_id("wtemplate"),
            **payload,
            "created_at": now,
            "updated_at": now,
        }
        self.templates[template["id"]] = template
        return _clone(template)

    async def update_template(self, template_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        current = self.templates.get(template_id)
        if current is None:
            raise NotFoundError(f"Worship template '{template_id}' was not found.")
        if "service_kind" in payload:
            if any(
                item["service_kind"] == payload["service_kind"] and item["id"] != template_id
                for item in self.templates.values()
            ):
                raise ConflictError(f"Service kind '{payload['service_kind']}' already exists.")
        current.update({**payload, "updated_at": iso_now()})
        return _clone(current)

    async def list_services_between(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        rows = [
            row
            for row in self.services.values()
            if start_date <= row["date"] <= end_date
        ]
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
