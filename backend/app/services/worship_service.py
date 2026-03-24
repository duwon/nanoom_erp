from __future__ import annotations

import hashlib
import re
import secrets
from copy import deepcopy
from datetime import date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from app.core.store import ConflictError, NotFoundError, iso_now, new_id
from app.modules.udms.repository import UdmsRepository
from app.modules.worship.adapters import PresentationAdapter, ScriptureAdapter, SongCatalogAdapter
from app.modules.worship.repository import WorshipRepository, template_applies
from app.modules.worship.schemas import (
    WorshipCalendarTemplateOption,
    WorshipCalendarResponse,
    WorshipFieldType,
    WorshipInputTemplate,
    WorshipInputTemplateUpsert,
    WorshipGuestInputPayload,
    WorshipGuestLinkResponse,
    WorshipGuestTaskView,
    WorshipLyricsParseResponse,
    WorshipPresentationPreview,
    WorshipPresentationState,
    WorshipReviewResponse,
    WorshipSectionCapabilities,
    WorshipSectionTypeDefinition,
    WorshipSectionTypeDefinitionUpsert,
    WorshipScriptureLookupResponse,
    WorshipSection,
    WorshipSlideTemplate,
    WorshipSlideTemplateUpsert,
    WorshipServiceCreate,
    WorshipServiceDetail,
    WorshipServiceStatus,
    WorshipSlide,
    WorshipSongLookupItem,
    WorshipTemplate,
    WorshipTemplateUpsert,
    WorshipWorkspaceBucket,
)
from app.modules.worship.udms_bridge import WorshipUdmsBridge
from app.schemas.display import DisplayState
from app.schemas.order_item import OrderItem, OrderItemUpdate
from app.ws.connection_manager import ConnectionManager

WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
EDIT_ROLES = {"master", "editor", "final_approver"}
AUTO_MATERIALIZE_FUTURE_DAYS = 10


def _normalize_role_names(values: list[str] | None) -> set[str]:
    return {str(value).strip() for value in values or [] if str(value).strip()}


def _parse_date(value: str) -> date:
    return date.fromisoformat(value)


def _join_slide_lines(slides: list[dict[str, Any]]) -> str:
    chunks = ["\n".join(slide.get("lines", [])) for slide in slides if slide.get("lines")]
    return "\n\n".join(chunk for chunk in chunks if chunk.strip())


class WorshipService:
    def __init__(
        self,
        repository: WorshipRepository,
        ws_manager: ConnectionManager,
        *,
        song_adapter: SongCatalogAdapter,
        scripture_adapter: ScriptureAdapter,
        presentation_adapter: PresentationAdapter,
        timezone_name: str = "Asia/Seoul",
        frontend_app_url: str = "http://localhost:3000",
        udms_repository: UdmsRepository | None = None,
    ):
        self.repository = repository
        self.ws_manager = ws_manager
        self.song_adapter = song_adapter
        self.scripture_adapter = scripture_adapter
        self.presentation_adapter = presentation_adapter
        self.timezone = ZoneInfo(timezone_name)
        self.frontend_app_url = frontend_app_url.rstrip("/")
        self.udms_repository = udms_repository
        self.udms_bridge = WorshipUdmsBridge(udms_repository) if udms_repository is not None else None

    def attach_udms_repository(self, repository: UdmsRepository) -> None:
        self.udms_repository = repository
        self.udms_bridge = WorshipUdmsBridge(repository)

    async def seed_defaults(self) -> None:
        await self.repository.reset_service_state()
        if self.udms_bridge is not None:
            await self.udms_bridge.reset()
        await self.repository.ensure_indexes()
        await self.repository.seed_defaults_if_empty()

    def _local_today(self) -> date:
        return datetime.now(self.timezone).date()

    def _service_datetime(self, target_date: date, start_time: str) -> datetime:
        hour, minute = [int(part) for part in start_time.split(":", 1)]
        return datetime.combine(target_date, time(hour=hour, minute=minute), tzinfo=self.timezone)

    def _hash_token(self, token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def _ensure_editable(self, user: dict[str, Any]) -> None:
        if user.get("role") not in EDIT_ROLES:
            raise ConflictError("Editing requires editor, final_approver, or master role.")

    def _ensure_version(self, service: dict[str, Any], expected_version: int) -> None:
        if int(service["version"]) != int(expected_version):
            raise ConflictError("The worship service has changed. Refresh and try again.")

    def _is_manage_role(self, user: dict[str, Any]) -> bool:
        return user.get("role") in EDIT_ROLES

    def _is_editable_section(self, section: dict[str, Any]) -> bool:
        return bool(section.get("input_template_id"))

    def _is_music_section(self, section: dict[str, Any]) -> bool:
        return section.get("workspace_bucket") == WorshipWorkspaceBucket.music.value

    def _can_edit_section(self, user: dict[str, Any], section: dict[str, Any]) -> bool:
        if self._is_manage_role(user):
            return True
        if not self._is_editable_section(section):
            return False
        if section.get("assignee_id") == user.get("id"):
            return True
        if section.get("assignee_id"):
            return False
        return section.get("role") in _normalize_role_names(user.get("worship_roles"))

    def _ensure_section_access(self, user: dict[str, Any], section: dict[str, Any], *, action: str) -> None:
        allowed = self._can_edit_section(user, section)
        if action == "assign":
            allowed = self._is_manage_role(user)
        elif action == "share":
            allowed = self._can_edit_section(user, section)
        elif action == "remove":
            allowed = self._can_edit_section(user, section) and self._is_music_section(section)
        elif action == "add_song":
            allowed = self._can_edit_section(user, section) and self._is_music_section(section)
        if not allowed:
            raise ConflictError("You do not have permission for this worship section.")

    def _required_fields(self, task: dict[str, Any]) -> list[dict[str, Any]]:
        return [deepcopy(field) for field in task.get("required_fields", [])]

    def _field_map(self, task: dict[str, Any]) -> dict[str, dict[str, Any]]:
        return {field["key"]: field for field in self._required_fields(task)}

    def _task_scope(self, section: dict[str, Any]) -> str:
        return section.get("title") or section.get("detail") or section.get("section_type_code", "")

    def _normalize_task(self, service: dict[str, Any], section: dict[str, Any], task: dict[str, Any] | None = None) -> dict[str, Any]:
        task = deepcopy(task or {})
        guest_access = task.get("guest_access") or {}
        values = dict(task.get("values") or {})
        return {
            "id": task.get("id") or f"task-{section['id']}",
            "section_id": section["id"],
            "input_template_id": task.get("input_template_id") or section.get("input_template_id", ""),
            "role": task.get("role") or section.get("role", ""),
            "scope": task.get("scope") or self._task_scope(section),
            "required_fields": deepcopy(task.get("required_fields") or []),
            "status": task.get("status") or section.get("status", WorshipServiceStatus.waiting.value),
            "due_at": task.get("due_at"),
            "tips": task.get("tips", ""),
            "guest_access": {
                "token_hash": guest_access.get("token_hash"),
                "issued_at": guest_access.get("issued_at"),
                "expires_at": guest_access.get("expires_at"),
                "revoked_at": guest_access.get("revoked_at"),
                "last_opened_at": guest_access.get("last_opened_at"),
            },
            "last_submitted_at": task.get("last_submitted_at"),
            "values": values,
        }

    def _normalize_tasks(self, service: dict[str, Any]) -> None:
        section_map = {section["id"]: section for section in service.get("sections", [])}
        normalized: dict[str, dict[str, Any]] = {}
        for task in service.get("tasks", []):
            section_id = task.get("section_id")
            section = section_map.get(section_id)
            if section is None or not self._is_editable_section(section):
                continue
            normalized[section_id] = self._normalize_task(service, section, task)
        for section in service.get("sections", []):
            if not self._is_editable_section(section):
                continue
            normalized.setdefault(section["id"], self._normalize_task(service, section))
        service["tasks"] = [normalized[section["id"]] for section in service.get("sections", []) if section["id"] in normalized]

    def _build_section_capabilities(self, user: dict[str, Any] | None, service: dict[str, Any], section: dict[str, Any]) -> dict[str, bool]:
        if user is None:
            return WorshipSectionCapabilities().model_dump()
        can_edit = self._can_edit_section(user, section)
        music_count = len([item for item in service.get("sections", []) if self._is_music_section(item)])
        return WorshipSectionCapabilities(
            can_edit=can_edit,
            can_assign=self._is_manage_role(user),
            can_share=can_edit,
            can_add_sibling_song=can_edit and self._is_music_section(section),
            can_remove=can_edit and self._is_music_section(section) and music_count > 1,
        ).model_dump(mode="json")

    def _compute_review_summary(self, service: dict[str, Any]) -> dict[str, Any]:
        status_counts = {status.value: 0 for status in WorshipServiceStatus}
        for section in service.get("sections", []):
            status_counts[section["status"]] = status_counts.get(section["status"], 0) + 1
        pending_task_count = len(
            [task for task in service.get("tasks", []) if task.get("status") != WorshipServiceStatus.complete.value]
        )
        return {
            "total_sections": len(service.get("sections", [])),
            "complete_sections": status_counts[WorshipServiceStatus.complete.value],
            "progress_sections": status_counts[WorshipServiceStatus.progress.value],
            "waiting_sections": status_counts[WorshipServiceStatus.waiting.value],
            "review_sections": status_counts[WorshipServiceStatus.review.value],
            "pending_review_count": status_counts[WorshipServiceStatus.review.value]
            + status_counts[WorshipServiceStatus.progress.value]
            + status_counts[WorshipServiceStatus.waiting.value],
            "pending_task_count": pending_task_count,
        }

    def _compute_service_status(self, service: dict[str, Any]) -> str:
        summary = self._compute_review_summary(service)
        if summary["total_sections"] and summary["waiting_sections"] == summary["total_sections"]:
            return WorshipServiceStatus.waiting.value
        if summary["pending_review_count"] > 0:
            return WorshipServiceStatus.progress.value
        return WorshipServiceStatus.complete.value

    def _sync_task_statuses(self, service: dict[str, Any]) -> None:
        sections = {section["id"]: section for section in service.get("sections", [])}
        for task in service.get("tasks", []):
            section = sections.get(task.get("section_id"))
            if section is None:
                task["status"] = WorshipServiceStatus.waiting.value
                continue
            task["status"] = section["status"]

    def _sync_service(self, service: dict[str, Any]) -> dict[str, Any]:
        service["sections"] = sorted(service.get("sections", []), key=lambda item: item["order"])
        self._normalize_tasks(service)
        self._sync_task_statuses(service)
        service["task_guest_access"] = {
            task["id"]: deepcopy(task.get("guest_access", {})) for task in service.get("tasks", [])
        }
        service["review_summary"] = self._compute_review_summary(service)
        service["status"] = self._compute_service_status(service)
        return service

    def _serialize_service(self, service: dict[str, Any], user: dict[str, Any] | None = None) -> WorshipServiceDetail:
        synced = self._sync_service(service)
        if user is not None:
            for section in synced.get("sections", []):
                section["capabilities"] = self._build_section_capabilities(user, synced, section)
        return WorshipServiceDetail.model_validate(synced)

    async def _materialize_service(
        self,
        template: dict[str, Any],
        target_date: date,
        *,
        actor_id: str = "system",
        change_log: str = "Materialize worship service",
    ) -> dict[str, Any]:
        now = iso_now()
        service_id = f"svc-{target_date.isoformat()}-{template['service_kind']}"
        start_dt = self._service_datetime(target_date, template["start_time"])
        start_at = start_dt.isoformat()
        input_templates = {item["id"]: item for item in await self.repository.list_input_templates(active_only=False)}
        sections: list[dict[str, Any]] = []
        tasks: list[dict[str, Any]] = []
        for preset in template.get("default_sections", []):
            section = {
                "id": preset["id"],
                "order": preset["order"],
                "section_type_code": preset["section_type_code"],
                "workspace_bucket": preset["workspace_bucket"],
                "title": preset["title"],
                "detail": preset.get("detail", ""),
                "role": preset.get("role", ""),
                "assignee_id": None,
                "assignee_name": preset.get("assignee_name"),
                "status": WorshipServiceStatus.waiting.value,
                "duration_minutes": preset.get("duration_minutes", 0),
                "due_offset_minutes": preset.get("due_offset_minutes", 0),
                "input_template_id": preset.get("input_template_id", ""),
                "slide_template_key": preset.get("slide_template_key", ""),
                "notes": preset.get("notes", ""),
                "content": preset.get("content", {}),
                "slides": [],
                "updated_at": now,
            }
            sections.append(section)
            input_template = input_templates.get(section["input_template_id"])
            if input_template is None:
                continue
            tasks.append(
                self._normalize_task(
                    {},
                    section,
                    {
                        "id": f"task-{section['id']}",
                        "input_template_id": section["input_template_id"],
                        "role": section.get("role", ""),
                        "scope": self._task_scope(section),
                        "required_fields": input_template.get("fields", []),
                        "status": WorshipServiceStatus.waiting.value,
                        "due_at": (start_dt - timedelta(minutes=int(section.get("due_offset_minutes", 0)))).isoformat(),
                        "tips": input_template.get("tips", ""),
                        "guest_access": {
                            "token_hash": None,
                            "issued_at": None,
                            "expires_at": None,
                            "revoked_at": None,
                            "last_opened_at": None,
                        },
                        "last_submitted_at": None,
                        "values": {},
                    },
                )
            )
        service = {
            "id": service_id,
            "date": target_date.isoformat(),
            "service_kind": template["service_kind"],
            "service_name": template["display_name"],
            "start_at": start_at,
            "summary": f"{template['display_name']} 준비",
            "template_id": template["id"],
            "version": 1,
            "status": WorshipServiceStatus.waiting.value,
            "sections": sections,
            "tasks": tasks,
            "review_summary": {},
            "export_snapshot": {},
            "metadata": {"created_at": now, "updated_at": now},
        }
        service = self._sync_service(service)
        if self.udms_bridge is not None:
            service = await self.udms_bridge.sync_service_documents(
                service,
                actor_id=actor_id,
                change_log=change_log,
                create_policies=True,
            )
        return self._sync_service(service)

    def _available_templates_for_day(
        self,
        services: list[dict[str, Any]],
        templates: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        existing_kinds = {service["service_kind"] for service in services}
        options = [
            WorshipCalendarTemplateOption(
                template_id=template["id"],
                service_kind=template["service_kind"],
                display_name=template["display_name"],
                start_time=template["start_time"],
            ).model_dump(mode="json")
            for template in templates
            if template["service_kind"] not in existing_kinds
        ]
        options.sort(key=lambda item: (item["start_time"], item["display_name"]))
        return options

    async def _ensure_calendar_materialized(self, anchor: date, days: int) -> list[dict[str, Any]]:
        half = days // 2
        start = anchor - timedelta(days=half)
        end = start + timedelta(days=days - 1)
        max_auto_date = self._local_today() + timedelta(days=AUTO_MATERIALIZE_FUTURE_DAYS)
        existing = {
            (service["date"], service["service_kind"]): service
            for service in await self.repository.list_services_between(start.isoformat(), end.isoformat())
        }
        templates = await self.repository.list_templates(active_only=True)
        created: list[dict[str, Any]] = []
        for offset in range(days):
            target = start + timedelta(days=offset)
            if target > max_auto_date:
                continue
            for template in templates:
                if not template_applies(template, target):
                    continue
                key = (target.isoformat(), template["service_kind"])
                if key in existing:
                    continue
                service = await self._materialize_service(template, target)
                existing[key] = await self.repository.save_service(service)
                created.append(existing[key])
        services = list(existing.values())
        services.sort(key=lambda item: (item["date"], item["start_at"]))
        return services

    def _find_section(self, service: dict[str, Any], section_id: str) -> dict[str, Any]:
        section = next((item for item in service.get("sections", []) if item["id"] == section_id), None)
        if section is None:
            raise NotFoundError(f"Section '{section_id}' was not found.")
        return section

    def _find_task(self, service: dict[str, Any], task_id: str) -> dict[str, Any]:
        task = next((item for item in service.get("tasks", []) if item["id"] == task_id), None)
        if task is None:
            raise NotFoundError(f"Task '{task_id}' was not found.")
        return task

    def _find_task_for_section(self, service: dict[str, Any], section_id: str) -> dict[str, Any]:
        task = next((item for item in service.get("tasks", []) if item.get("section_id") == section_id), None)
        if task is None:
            raise NotFoundError(f"Task for section '{section_id}' was not found.")
        return task

    def _filtered_values(self, task: dict[str, Any], values: dict[str, Any]) -> dict[str, Any]:
        allowed = {field["key"] for field in self._required_fields(task)}
        return {key: value for key, value in values.items() if key in allowed}

    def _has_meaningful_values(self, values: dict[str, Any]) -> bool:
        for value in values.values():
            if isinstance(value, str) and value.strip():
                return True
            if value not in (None, "", [], {}):
                return True
        return False

    def _is_complete(self, task: dict[str, Any], values: dict[str, Any]) -> bool:
        for field in self._required_fields(task):
            if not field.get("required", True):
                continue
            value = values.get(field["key"])
            if isinstance(value, str):
                if not value.strip():
                    return False
            elif value in (None, "", [], {}):
                return False
        return True

    def _section_binding(self, field_type: str) -> str:
        """field_type에서 섹션 필드 바인딩을 자동 결정합니다."""
        return {
            WorshipFieldType.title: "title",
            WorshipFieldType.text: "title",      # 하위 호환
            WorshipFieldType.song_search: "title",
            WorshipFieldType.detail: "detail",
            WorshipFieldType.scripture: "detail",
            WorshipFieldType.notes: "notes",
        }.get(field_type, "none")  # type: ignore[arg-type]

    async def _apply_values_to_section(self, section: dict[str, Any], task: dict[str, Any], values: dict[str, Any], *, mark_complete: bool) -> dict[str, Any]:
        values = self._filtered_values(task, values)
        field_map = self._field_map(task)
        section.setdefault("content", {})
        section["content"].update(values)
        for key, value in values.items():
            field = field_map[key]
            field_type = field.get("field_type", "")
            text = str(value).strip() if isinstance(value, str) else value
            binding = self._section_binding(field_type)
            if binding == "title" and isinstance(text, str):
                section["title"] = text
            elif binding == "detail" and isinstance(text, str):
                section["detail"] = text
            elif binding == "notes" and isinstance(text, str):
                section["notes"] = text
        for key, value in values.items():
            field = field_map[key]
            if not isinstance(value, str):
                continue
            text = value.strip()
            if field.get("field_type") == WorshipFieldType.scripture.value and text:
                match = re.match(r"^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$", text)
                if match:
                    scripture = await self.lookup_scripture(
                        book=match[1],
                        chapter=int(match[2]),
                        verse_start=int(match[3]),
                        verse_end=int(match[4]) if match[4] else None,
                    )
                    section["slides"] = [slide.model_dump() for slide in scripture.slides]
            elif field.get("field_type") == WorshipFieldType.lyrics.value and text:
                parsed = self._parse_lyrics(text, section.get("slide_template_key") or "lyrics-16x9")
                section["slides"] = [slide.model_dump() for slide in parsed.slides]
        if mark_complete:
            if not self._is_complete(task, values):
                raise ConflictError("Required fields must be completed before marking this section complete.")
            section["status"] = WorshipServiceStatus.review.value
        else:
            section["status"] = (
                WorshipServiceStatus.progress.value if self._has_meaningful_values(values) else WorshipServiceStatus.waiting.value
            )
        section["updated_at"] = iso_now()
        return values

    def _default_service_id(self, services: list[dict[str, Any]], anchor: date) -> str | None:
        if not services:
            return None
        def sort_key(service: dict[str, Any]) -> tuple[int, str]:
            delta = abs((_parse_date(service["date"]) - anchor).days)
            return (delta, service["start_at"])
        return min(services, key=sort_key)["id"]

    async def list_calendar(self, anchor_date: str | None = None, days: int = 12) -> WorshipCalendarResponse:
        anchor = _parse_date(anchor_date) if anchor_date else self._local_today()
        days = max(1, days)
        services = await self._ensure_calendar_materialized(anchor, days)
        templates = await self.repository.list_templates(active_only=True)
        half = days // 2
        start = anchor - timedelta(days=half)
        grouped: dict[str, list[dict[str, Any]]] = {}
        for service in services:
            grouped.setdefault(service["date"], []).append(service)
        response = {
            "anchor_date": anchor.isoformat(),
            "days": [],
            "default_service_id": self._default_service_id(services, anchor),
        }
        for offset in range(days):
            target = start + timedelta(days=offset)
            date_key = target.isoformat()
            day_services = [self._sync_service(item) for item in grouped.get(date_key, [])]
            response["days"].append(
                {
                    "date": date_key,
                    "date_label": date_key,
                    "weekday_label": WEEKDAY_LABELS[target.weekday()],
                    "services": day_services,
                    "available_templates": self._available_templates_for_day(day_services, templates),
                }
            )
        return WorshipCalendarResponse.model_validate(response)

    async def get_service(self, user: dict[str, Any], service_id: str) -> WorshipServiceDetail:
        service = await self.repository.get_service(service_id)
        return self._serialize_service(service, user)

    async def service_exists(self, service_id: str) -> None:
        await self.repository.get_service(service_id)

    async def update_service(self, user: dict[str, Any], service_id: str, payload: dict[str, Any]) -> WorshipServiceDetail:
        self._ensure_editable(user)
        service = await self.repository.get_service(service_id)
        self._ensure_version(service, payload["version"])
        for key in ("summary", "service_name", "start_at"):
            if payload.get(key) is not None:
                service[key] = payload[key]
        service["metadata"]["updated_at"] = iso_now()
        service = self._sync_service(service)
        if self.udms_bridge is not None:
            service = await self.udms_bridge.sync_service_documents(
                service,
                actor_id=user["id"],
                change_log="Update worship service",
                create_policies=False,
            )
        else:
            service["version"] += 1
        return self._serialize_service(await self.repository.save_service(self._sync_service(service)), user)

    async def create_service(self, user: dict[str, Any], payload: WorshipServiceCreate) -> WorshipServiceDetail:
        self._ensure_editable(user)
        target_date = _parse_date(payload.target_date)
        template = await self.repository.get_template(payload.template_id)
        if not template.get("is_active", True):
            raise ConflictError("Inactive worship templates cannot be used.")
        existing = await self.repository.find_service_by_date_and_kind(target_date.isoformat(), template["service_kind"])
        if existing is not None:
            raise ConflictError("A worship service for this date and template already exists.")
        service = await self._materialize_service(
            template,
            target_date,
            actor_id=user["id"],
            change_log="Create worship service manually",
        )
        saved = await self.repository.save_service(self._sync_service(service))
        return self._serialize_service(saved, user)

    async def update_section(self, user: dict[str, Any], service_id: str, section_id: str, payload: dict[str, Any]) -> WorshipServiceDetail:
        service = await self.repository.get_service(service_id)
        self._ensure_version(service, payload["version"])
        section = self._find_section(service, section_id)
        if any(key in payload and payload[key] is not None for key in ("role", "assignee_id", "assignee_name")):
            self._ensure_section_access(user, section, action="assign")
        else:
            self._ensure_section_access(user, section, action="edit")
        content_updated = False
        for key in ("title", "detail", "role", "assignee_id", "assignee_name", "status", "duration_minutes", "due_offset_minutes", "input_template_id", "slide_template_key", "notes", "content", "slides"):
            if key in payload and payload[key] is not None:
                section[key] = payload[key]
                if key in ("content", "slides"):
                    content_updated = True
        if payload.get("editor_values") is not None:
            task = self._find_task_for_section(service, section_id)
            task["values"] = await self._apply_values_to_section(
                section,
                task,
                payload.get("editor_values", {}),
                mark_complete=bool(payload.get("mark_complete")),
            )
            task["last_submitted_at"] = iso_now()
            content_updated = True
        if content_updated:
            section["content_editor_id"] = user["id"]
        service["metadata"]["updated_at"] = iso_now()
        service = self._sync_service(service)
        if self.udms_bridge is not None:
            service = await self.udms_bridge.sync_service_documents(
                service,
                actor_id=user["id"],
                change_log=f"Update worship section {section_id}",
                create_policies=False,
            )
        else:
            service["version"] += 1
        return self._serialize_service(await self.repository.save_service(self._sync_service(service)), user)

    async def reorder_sections(self, user: dict[str, Any], service_id: str, payload: dict[str, Any]) -> WorshipServiceDetail:
        self._ensure_editable(user)
        service = await self.repository.get_service(service_id)
        self._ensure_version(service, payload["version"])
        sections = {section["id"]: section for section in service.get("sections", [])}
        for item in payload.get("sections", []):
            if item["section_id"] not in sections:
                raise NotFoundError(f"Section '{item['section_id']}' was not found.")
            sections[item["section_id"]]["order"] = item["order"]
            sections[item["section_id"]]["updated_at"] = iso_now()
        service["sections"] = list(sections.values())
        service["metadata"]["updated_at"] = iso_now()
        service = self._sync_service(service)
        if self.udms_bridge is not None:
            service = await self.udms_bridge.sync_service_documents(
                service,
                actor_id=user["id"],
                change_log="Reorder worship sections",
                create_policies=False,
            )
        else:
            service["version"] += 1
        return self._serialize_service(await self.repository.save_service(self._sync_service(service)), user)

    async def add_section(self, user: dict[str, Any], service_id: str, payload: dict[str, Any]) -> WorshipServiceDetail:
        service = await self.repository.get_service(service_id)
        self._ensure_version(service, payload["version"])
        after_section = self._find_section(service, payload["after_section_id"]) if payload.get("after_section_id") else None
        if after_section is None or not self._is_music_section(after_section):
            raise ConflictError("New sections can only be inserted next to an existing music section.")
        self._ensure_section_access(user, after_section, action="add_song")
        section_type = await self.repository.get_section_type(payload["section_type_code"])
        if section_type.get("workspace_bucket") != WorshipWorkspaceBucket.music.value:
            raise ConflictError("Only music bucket section types can be inserted from this flow.")
        new_section = {
            "id": new_id("section"),
            "order": after_section["order"] + 1,
            "section_type_code": payload["section_type_code"],
            "workspace_bucket": section_type["workspace_bucket"],
            "title": section_type.get("default_title") or "추가 곡",
            "detail": "",
            "role": section_type.get("default_role") or after_section.get("role", ""),
            "assignee_id": after_section.get("assignee_id"),
            "assignee_name": after_section.get("assignee_name"),
            "status": WorshipServiceStatus.waiting.value,
            "duration_minutes": section_type.get("default_duration_minutes", 0),
            "due_offset_minutes": section_type.get("default_due_offset_minutes", 0),
            "input_template_id": section_type.get("default_input_template_id", ""),
            "slide_template_key": section_type.get("default_slide_template_key", ""),
            "notes": "",
            "content": {},
            "slides": [],
            "updated_at": iso_now(),
        }
        for section in service.get("sections", []):
            if section["order"] > after_section["order"]:
                section["order"] += 1
                section["updated_at"] = iso_now()
        service["sections"].append(new_section)
        service.setdefault("tasks", []).append(
            self._normalize_task(
                service,
                new_section,
                {
                    "id": f"task-{new_section['id']}",
                    "section_id": new_section["id"],
                    "input_template_id": new_section["input_template_id"],
                    "role": new_section["role"],
                    "scope": self._task_scope(new_section),
                    "required_fields": next(
                        (
                            item.get("fields", [])
                            for item in await self.repository.list_input_templates(active_only=False)
                            if item["id"] == new_section["input_template_id"]
                        ),
                        [],
                    ),
                    "status": WorshipServiceStatus.waiting.value,
                    "due_at": (self._service_datetime(_parse_date(service["date"]), service["start_at"][11:16]) - timedelta(minutes=int(new_section.get("due_offset_minutes", 0)))).isoformat(),
                    "tips": next(
                        (
                            item.get("tips", "")
                            for item in await self.repository.list_input_templates(active_only=False)
                            if item["id"] == new_section["input_template_id"]
                        ),
                        "",
                    ),
                    "guest_access": {
                        "token_hash": None,
                        "issued_at": None,
                        "expires_at": None,
                        "revoked_at": None,
                        "last_opened_at": None,
                    },
                    "last_submitted_at": None,
                    "values": {},
                },
            )
        )
        service["metadata"]["updated_at"] = iso_now()
        service = self._sync_service(service)
        if self.udms_bridge is not None:
            service = await self.udms_bridge.sync_service_documents(
                service,
                actor_id=user["id"],
                change_log=f"Add worship section after {after_section['id']}",
                create_policies=False,
            )
        else:
            service["version"] += 1
        return self._serialize_service(await self.repository.save_service(self._sync_service(service)), user)

    async def delete_section(self, user: dict[str, Any], service_id: str, section_id: str, version: int) -> WorshipServiceDetail:
        service = await self.repository.get_service(service_id)
        self._ensure_version(service, version)
        section = self._find_section(service, section_id)
        self._ensure_section_access(user, section, action="remove")
        music_sections = [item for item in service.get("sections", []) if self._is_music_section(item)]
        if len(music_sections) <= 1:
            raise ConflictError("At least one music section must remain.")
        removed_order = section["order"]
        service["sections"] = [item for item in service.get("sections", []) if item["id"] != section_id]
        for item in service.get("sections", []):
            if item["order"] > removed_order:
                item["order"] -= 1
                item["updated_at"] = iso_now()
        service["tasks"] = [task for task in service.get("tasks", []) if task.get("section_id") != section_id]
        service["metadata"]["updated_at"] = iso_now()
        service = self._sync_service(service)
        if self.udms_bridge is not None:
            service = await self.udms_bridge.sync_service_documents(
                service,
                actor_id=user["id"],
                change_log=f"Delete worship section {section_id}",
                create_policies=False,
            )
        else:
            service["version"] += 1
        return self._serialize_service(await self.repository.save_service(self._sync_service(service)), user)

    def _guest_expires_at(self, due_at: str | None) -> str:
        now = datetime.now(self.timezone)
        return (now + timedelta(days=7)).isoformat()

    async def issue_guest_link(self, user: dict[str, Any], service_id: str, task_id: str) -> WorshipGuestLinkResponse:
        service = await self.repository.get_service(service_id)
        task = self._find_task(service, task_id)
        section = self._find_section(service, task["section_id"])
        self._ensure_section_access(user, section, action="share")
        token = secrets.token_urlsafe(24)
        task["guest_access"] = {
            "token_hash": self._hash_token(token),
            "issued_by_id": user["id"],
            "issued_at": iso_now(),
            "expires_at": self._guest_expires_at(task.get("due_at")),
            "revoked_at": None,
            "last_opened_at": None,
        }
        service["metadata"]["updated_at"] = iso_now()
        service = self._sync_service(service)
        if self.udms_bridge is not None:
            service = await self.udms_bridge.touch_order_document(
                service,
                actor_id=user["id"],
                change_log=f"Issue guest link for {task_id}",
            )
        else:
            service["version"] += 1
        await self.repository.save_service(self._sync_service(service))
        return WorshipGuestLinkResponse(
            task_id=task_id,
            token=token,
            input_url=f"{self.frontend_app_url}/worship/input/{token}",
            expires_at=task["guest_access"]["expires_at"],
        )

    async def get_guest_input(self, token: str) -> WorshipGuestTaskView:
        token_hash = self._hash_token(token)
        service, task_row = await self.repository.find_service_task_by_token_hash(token_hash)
        task = next((item for item in service.get("tasks", []) if item["id"] == task_row["id"]), None)
        if task is None:
            raise NotFoundError("Guest input was not found.")
        guest_access = task.get("guest_access", {})
        if guest_access.get("revoked_at"):
            raise ConflictError("This guest link has been revoked.")
        expires_at = guest_access.get("expires_at")
        if expires_at and datetime.fromisoformat(expires_at) < datetime.now(self.timezone):
            raise ConflictError("This guest link has expired.")
        task["guest_access"]["last_opened_at"] = iso_now()
        await self.repository.save_service(self._sync_service(service))
        return WorshipGuestTaskView(
            task_id=task["id"],
            section_id=task["section_id"],
            service_id=service["id"],
            service_name=service["service_name"],
            date=service["date"],
            role=task["role"],
            scope=task.get("scope", ""),
            due_at=task.get("due_at"),
            tips=task.get("tips", ""),
            status=task["status"],
            required_fields=task.get("required_fields", []),
            values=task.get("values", {}),
        )

    async def submit_guest_input(self, token: str, payload: WorshipGuestInputPayload) -> WorshipGuestTaskView:
        token_hash = self._hash_token(token)
        service, task_row = await self.repository.find_service_task_by_token_hash(token_hash)
        task = next((item for item in service.get("tasks", []) if item["id"] == task_row["id"]), None)
        if task is None:
            raise NotFoundError("Guest input was not found.")
        guest_access = task.get("guest_access", {})
        if guest_access.get("revoked_at"):
            raise ConflictError("This guest link has been revoked.")
        expires_at = guest_access.get("expires_at")
        if expires_at and datetime.fromisoformat(expires_at) < datetime.now(self.timezone):
            raise ConflictError("This guest link has expired.")
        section = self._find_section(service, task["section_id"])
        values = await self._apply_values_to_section(section, task, payload.values, mark_complete=payload.mark_complete)
        task["values"] = values
        task["last_submitted_at"] = iso_now()
        issued_by_id = guest_access.get("issued_by_id") or "system"
        section["content_editor_id"] = issued_by_id
        service["metadata"]["updated_at"] = iso_now()
        service = self._sync_service(service)
        if self.udms_bridge is not None:
            service = await self.udms_bridge.sync_service_documents(
                service,
                actor_id=issued_by_id,
                change_log=f"Submit guest input for {task['id']}",
                create_policies=False,
            )
        else:
            service["version"] += 1
        await self.repository.save_service(self._sync_service(service))
        return await self.get_guest_input(token)

    async def search_songs(self, query: str) -> list[WorshipSongLookupItem]:
        return await self.song_adapter.search(query)

    async def lookup_scripture(
        self,
        *,
        book: str,
        chapter: int,
        verse_start: int,
        verse_end: int | None = None,
        translation: str = "KRV",
    ) -> WorshipScriptureLookupResponse:
        return await self.scripture_adapter.lookup(
            book=book,
            chapter=chapter,
            verse_start=verse_start,
            verse_end=verse_end,
            translation=translation,
        )

    def _parse_lyrics(self, lyrics: str, slide_template_key: str) -> WorshipLyricsParseResponse:
        slides: list[WorshipSlide] = []
        normalized = lyrics.replace("\r\n", "\n").strip()
        blocks = [block.strip() for block in normalized.split("\n\n") if block.strip()]
        if not blocks:
            blocks = [normalized]
        for index, block in enumerate(blocks, start=1):
            lines = [line.strip() for line in block.split("\n") if line.strip()]
            label = f"Slide {index}"
            if lines and lines[0].lower().startswith(("verse", "chorus", "bridge")):
                label = lines[0]
                lines = lines[1:] or [label]
            slides.append(
                WorshipSlide(
                    id=f"slide-{index}",
                    label=label,
                    lines=lines,
                    slide_template_key=slide_template_key,
                )
            )
        return WorshipLyricsParseResponse(slides=slides)

    async def parse_lyrics_for_section(
        self,
        user: dict[str, Any],
        service_id: str,
        section_id: str,
        lyrics: str,
        slide_template_key: str,
    ) -> WorshipLyricsParseResponse:
        service = await self.repository.get_service(service_id)
        section = self._find_section(service, section_id)
        self._ensure_section_access(user, section, action="edit")
        return self._parse_lyrics(lyrics, slide_template_key)

    def _build_preview_sections(self, service: dict[str, Any], selected_ids: list[str] | None = None) -> list[dict[str, Any]]:
        selected = set(selected_ids or [])
        sections = service.get("sections", [])
        if selected:
            sections = [section for section in sections if section["id"] in selected]
        preview_sections: list[dict[str, Any]] = []
        for section in sections:
            preview = deepcopy(section)
            if not preview.get("slides"):
                fallback = preview.get("detail") or preview.get("title")
                preview["slides"] = [
                    WorshipSlide(
                        id=f"{preview['id']}-fallback",
                        label=preview["title"],
                        lines=[fallback],
                        slide_template_key=preview.get("slide_template_key", ""),
                    ).model_dump()
                ]
            preview_sections.append(preview)
        return preview_sections

    async def get_review(self, user: dict[str, Any], service_id: str) -> WorshipReviewResponse:
        service = await self.repository.get_service(service_id)
        items = [
            {
                "section_id": section["id"],
                "order": section["order"],
                "title": section["title"],
                "detail": section.get("detail", ""),
                "status": section["status"],
                "slide_template_key": section.get("slide_template_key", ""),
                "notes": section.get("notes", ""),
            }
            for section in service.get("sections", [])
            if section["status"] in {
                WorshipServiceStatus.progress.value,
                WorshipServiceStatus.waiting.value,
                WorshipServiceStatus.review.value,
            }
        ]
        preview_sections = self._build_preview_sections(service)
        preview = WorshipPresentationPreview(
            service_id=service["id"],
            service_name=service["service_name"],
            generated_at=iso_now(),
            sections=preview_sections,
        )
        service["export_snapshot"] = preview.model_dump(mode="json")
        await self.repository.save_service(self._sync_service(service))
        return WorshipReviewResponse(
            service=self._serialize_service(service, user),
            items=items,
            preview=preview,
        )

    async def activate_presentation(
        self,
        user: dict[str, Any],
        service_id: str,
        selected_section_ids: list[str] | None = None,
    ) -> WorshipPresentationState:
        self._ensure_editable(user)
        service = await self.repository.get_service(service_id)
        preview_sections = self._build_preview_sections(service, selected_section_ids)
        if not preview_sections:
            raise ConflictError("No sections were selected for presentation.")
        active = preview_sections[0]
        first_slide = active["slides"][0]
        content = _join_slide_lines(active["slides"]) or "\n".join(first_slide.get("lines", []))
        state = WorshipPresentationState(
            service_id=service_id,
            active_section_id=active["id"],
            title=active["title"],
            content=content,
            updated_at=iso_now(),
        )
        await self.repository.save_presentation_state(state.model_dump())
        await self.ws_manager.broadcast("display.updated", DisplayState(
            activeItemId=state.active_section_id,
            title=state.title,
            content=state.content,
            updatedAt=datetime.fromisoformat(state.updated_at) if state.updated_at else None,
        ).model_dump(mode="json"))
        await self.presentation_adapter.push(
            {
                "serviceId": service_id,
                "serviceName": service["service_name"],
                "sections": preview_sections,
            }
        )
        service["export_snapshot"] = {
            "service_id": service_id,
            "sections": preview_sections,
            "activated_at": state.updated_at,
        }
        await self.repository.save_service(self._sync_service(service))
        return state

    def _usage_counts(self, templates: list[dict[str, Any]]) -> tuple[dict[str, int], dict[str, int], dict[str, int]]:
        section_type_counts: dict[str, int] = {}
        input_template_counts: dict[str, int] = {}
        slide_template_counts: dict[str, int] = {}
        for template in templates:
            for section in template.get("default_sections", []):
                section_type_counts[section["section_type_code"]] = section_type_counts.get(section["section_type_code"], 0) + 1
                input_template_counts[section["input_template_id"]] = input_template_counts.get(section["input_template_id"], 0) + 1
                if section.get("slide_template_key"):
                    slide_template_counts[section["slide_template_key"]] = slide_template_counts.get(section["slide_template_key"], 0) + 1
        return section_type_counts, input_template_counts, slide_template_counts

    async def _validate_template_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        section_types = {item["code"]: item for item in await self.repository.list_section_types(active_only=False)}
        input_templates = {item["id"]: item for item in await self.repository.list_input_templates(active_only=False)}
        slide_templates = {item["key"]: item for item in await self.repository.list_slide_templates(active_only=False)}
        next_payload = deepcopy(payload)
        next_sections = []
        for index, section in enumerate(next_payload.get("default_sections", []), start=1):
            section_type = section_types.get(section["section_type_code"])
            if section_type is None:
                raise ConflictError(f"Unknown section type '{section['section_type_code']}'.")
            if section["input_template_id"] not in input_templates:
                raise ConflictError(f"Unknown input template '{section['input_template_id']}'.")
            if section.get("slide_template_key") and section["slide_template_key"] not in slide_templates:
                raise ConflictError(f"Unknown slide template '{section['slide_template_key']}'.")
            next_section = deepcopy(section)
            next_section["order"] = index
            next_section["workspace_bucket"] = section_type["workspace_bucket"]
            next_sections.append(next_section)
        next_payload["default_sections"] = next_sections
        return next_payload

    async def list_templates(self) -> list[WorshipTemplate]:
        return [WorshipTemplate.model_validate(item) for item in await self.repository.list_templates()]

    async def create_template(self, payload: WorshipTemplateUpsert) -> WorshipTemplate:
        validated = await self._validate_template_payload(payload.model_dump())
        return WorshipTemplate.model_validate(await self.repository.create_template(validated))

    async def update_template(self, template_id: str, payload: WorshipTemplateUpsert) -> WorshipTemplate:
        validated = await self._validate_template_payload(payload.model_dump())
        return WorshipTemplate.model_validate(await self.repository.update_template(template_id, validated))

    async def delete_template(self, template_id: str) -> None:
        await self.repository.delete_template(template_id)

    async def list_section_types(self) -> list[WorshipSectionTypeDefinition]:
        templates = await self.repository.list_templates()
        section_counts, _, _ = self._usage_counts(templates)
        return [
            WorshipSectionTypeDefinition.model_validate({**item, "usage_count": section_counts.get(item["code"], 0)})
            for item in await self.repository.list_section_types()
        ]

    async def create_section_type(self, payload: WorshipSectionTypeDefinitionUpsert) -> WorshipSectionTypeDefinition:
        if payload.default_input_template_id:
            await self.repository.get_input_template(payload.default_input_template_id)
        if payload.default_slide_template_key:
            await self.repository.get_slide_template(payload.default_slide_template_key)
        return WorshipSectionTypeDefinition.model_validate(await self.repository.create_section_type(payload.model_dump()))

    async def update_section_type(self, code: str, payload: WorshipSectionTypeDefinitionUpsert) -> WorshipSectionTypeDefinition:
        if payload.default_input_template_id:
            await self.repository.get_input_template(payload.default_input_template_id)
        if payload.default_slide_template_key:
            await self.repository.get_slide_template(payload.default_slide_template_key)
        return WorshipSectionTypeDefinition.model_validate(await self.repository.update_section_type(code, payload.model_dump()))

    async def delete_section_type(self, code: str) -> None:
        templates = await self.repository.list_templates()
        section_counts, _, _ = self._usage_counts(templates)
        if section_counts.get(code, 0) > 0:
            raise ConflictError("Section type is in use. Deactivate it instead.")
        await self.repository.delete_section_type(code)

    async def list_input_templates(self) -> list[WorshipInputTemplate]:
        templates = await self.repository.list_templates()
        _, input_counts, _ = self._usage_counts(templates)
        return [
            WorshipInputTemplate.model_validate({**item, "usage_count": input_counts.get(item["id"], 0)})
            for item in await self.repository.list_input_templates()
        ]

    async def create_input_template(self, payload: WorshipInputTemplateUpsert) -> WorshipInputTemplate:
        return WorshipInputTemplate.model_validate(await self.repository.create_input_template(payload.model_dump()))

    async def update_input_template(self, template_id: str, payload: WorshipInputTemplateUpsert) -> WorshipInputTemplate:
        return WorshipInputTemplate.model_validate(await self.repository.update_input_template(template_id, payload.model_dump()))

    async def delete_input_template(self, template_id: str) -> None:
        templates = await self.repository.list_templates()
        _, input_counts, _ = self._usage_counts(templates)
        section_types = await self.repository.list_section_types(active_only=False)
        default_usage = sum(
            1 for item in section_types if item.get("default_input_template_id") == template_id
        )
        if input_counts.get(template_id, 0) > 0 or default_usage > 0:
            raise ConflictError("Input template is in use. Deactivate it instead.")
        await self.repository.delete_input_template(template_id)

    async def list_slide_templates(self) -> list[WorshipSlideTemplate]:
        templates = await self.repository.list_templates()
        _, _, slide_counts = self._usage_counts(templates)
        return [
            WorshipSlideTemplate.model_validate({**item, "usage_count": slide_counts.get(item["key"], 0)})
            for item in await self.repository.list_slide_templates()
        ]

    async def create_slide_template(self, payload: WorshipSlideTemplateUpsert) -> WorshipSlideTemplate:
        return WorshipSlideTemplate.model_validate(await self.repository.create_slide_template(payload.model_dump()))

    async def update_slide_template(self, key: str, payload: WorshipSlideTemplateUpsert) -> WorshipSlideTemplate:
        return WorshipSlideTemplate.model_validate(await self.repository.update_slide_template(key, payload.model_dump()))

    async def delete_slide_template(self, key: str) -> None:
        templates = await self.repository.list_templates()
        _, _, slide_counts = self._usage_counts(templates)
        section_types = await self.repository.list_section_types(active_only=False)
        default_usage = sum(
            1 for item in section_types if item.get("default_slide_template_key") == key
        )
        if slide_counts.get(key, 0) > 0 or default_usage > 0:
            raise ConflictError("Slide template is in use. Deactivate it instead.")
        await self.repository.delete_slide_template(key)

    async def get_presentation_state(self) -> DisplayState:
        state = WorshipPresentationState.model_validate(await self.repository.get_presentation_state())
        return DisplayState(
            activeItemId=state.active_section_id,
            title=state.title,
            content=state.content,
            updatedAt=datetime.fromisoformat(state.updated_at) if state.updated_at else None,
        )

    async def get_display_state(self) -> DisplayState:
        return await self.get_presentation_state()

    async def _compat_service(self) -> dict[str, Any]:
        state = await self.repository.get_presentation_state()
        service_id = state.get("service_id")
        if service_id:
            try:
                return await self.repository.get_service(service_id)
            except NotFoundError:
                pass
        calendar = await self.list_calendar(anchor_date=self._local_today().isoformat(), days=3)
        if calendar.default_service_id:
            return await self.repository.get_service(calendar.default_service_id)
        raise NotFoundError("No worship service is available.")

    async def list_order_items(self) -> list[OrderItem]:
        service = await self._compat_service()
        display = await self.repository.get_presentation_state()
        return [
            OrderItem(
                id=section["id"],
                title=section["title"],
                order=section["order"],
                content=_join_slide_lines(section.get("slides", [])) or section.get("detail", ""),
                isActive=display.get("active_section_id") == section["id"],
                updatedAt=datetime.fromisoformat(section["updated_at"]),
            )
            for section in sorted(service.get("sections", []), key=lambda item: item["order"])
        ]

    async def update_order_item(self, item_id: str, payload: OrderItemUpdate) -> OrderItem:
        service = await self._compat_service()
        section = next((item for item in service.get("sections", []) if item["id"] == item_id), None)
        if section is None:
            raise NotFoundError(f"Order item '{item_id}' was not found.")
        section["title"] = payload.title
        section["detail"] = payload.content
        section["slides"] = [
            WorshipSlide(
                id=f"{item_id}-legacy",
                label=payload.title,
                lines=[line for line in payload.content.splitlines() if line.strip()] or [payload.content],
                slide_template_key=section.get("slide_template_key", ""),
            ).model_dump()
        ]
        section["status"] = WorshipServiceStatus.review.value
        section["updated_at"] = iso_now()
        service["version"] += 1
        service["metadata"]["updated_at"] = iso_now()
        await self.repository.save_service(self._sync_service(service))
        return OrderItem(
            id=section["id"],
            title=section["title"],
            order=section["order"],
            content=payload.content,
            isActive=False,
            updatedAt=datetime.fromisoformat(section["updated_at"]),
        )

    async def activate_order_item(self, item_id: str) -> DisplayState:
        state = await self.activate_presentation({"role": "editor"}, (await self._compat_service())["id"], [item_id])
        return DisplayState(
            activeItemId=state.active_section_id,
            title=state.title,
            content=state.content,
            updatedAt=datetime.fromisoformat(state.updated_at) if state.updated_at else None,
        )

