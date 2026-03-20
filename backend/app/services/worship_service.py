from __future__ import annotations

import hashlib
import secrets
from copy import deepcopy
from datetime import date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from app.core.store import ConflictError, NotFoundError, iso_now
from app.modules.udms.repository import UdmsRepository
from app.modules.worship.adapters import PresentationAdapter, ScriptureAdapter, SongCatalogAdapter
from app.modules.worship.repository import WorshipRepository, template_applies
from app.modules.worship.schemas import (
    WorshipCalendarResponse,
    WorshipGuestInputPayload,
    WorshipGuestLinkResponse,
    WorshipGuestTaskView,
    WorshipLyricsParseResponse,
    WorshipPresentationPreview,
    WorshipPresentationState,
    WorshipReviewResponse,
    WorshipScriptureLookupResponse,
    WorshipSection,
    WorshipServiceDetail,
    WorshipServiceStatus,
    WorshipSlide,
    WorshipSongLookupItem,
    WorshipTemplate,
    WorshipTemplateUpsert,
)
from app.modules.worship.udms_bridge import WorshipUdmsBridge
from app.schemas.display import DisplayState
from app.schemas.order_item import OrderItem, OrderItemUpdate
from app.ws.connection_manager import ConnectionManager

WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"]
EDIT_ROLES = {"master", "editor", "final_approver"}


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
        if summary["review_sections"] > 0:
            return WorshipServiceStatus.review.value
        if summary["progress_sections"] > 0:
            return WorshipServiceStatus.progress.value
        if summary["waiting_sections"] > 0:
            return WorshipServiceStatus.waiting.value
        return WorshipServiceStatus.complete.value

    def _sync_task_statuses(self, service: dict[str, Any]) -> None:
        sections = {section["id"]: section for section in service.get("sections", [])}
        for task in service.get("tasks", []):
            linked = [sections[section_id] for section_id in task.get("section_ids", []) if section_id in sections]
            statuses = {section["status"] for section in linked}
            if not linked or WorshipServiceStatus.waiting.value in statuses:
                task["status"] = WorshipServiceStatus.waiting.value
            elif WorshipServiceStatus.review.value in statuses:
                task["status"] = WorshipServiceStatus.review.value
            elif WorshipServiceStatus.progress.value in statuses:
                task["status"] = WorshipServiceStatus.progress.value
            elif all(status == WorshipServiceStatus.complete.value for status in statuses):
                task["status"] = WorshipServiceStatus.complete.value

    def _sync_service(self, service: dict[str, Any]) -> dict[str, Any]:
        service["sections"] = sorted(service.get("sections", []), key=lambda item: item["order"])
        self._sync_task_statuses(service)
        service["task_guest_access"] = {
            task["id"]: deepcopy(task.get("guest_access", {})) for task in service.get("tasks", [])
        }
        service["review_summary"] = self._compute_review_summary(service)
        service["status"] = self._compute_service_status(service)
        return service

    def _serialize_service(self, service: dict[str, Any]) -> WorshipServiceDetail:
        return WorshipServiceDetail.model_validate(self._sync_service(service))

    async def _materialize_service(self, template: dict[str, Any], target_date: date) -> dict[str, Any]:
        now = iso_now()
        service_id = f"svc-{target_date.isoformat()}-{template['service_kind']}"
        start_at = self._service_datetime(target_date, template["start_time"]).isoformat()
        sections = [
            {
                "id": preset["id"],
                "order": preset["order"],
                "section_type": preset["section_type"],
                "title": preset["title"],
                "detail": preset.get("detail", ""),
                "role": preset.get("role", ""),
                "assignee_id": None,
                "assignee_name": preset.get("assignee_name"),
                "status": WorshipServiceStatus.waiting.value,
                "duration_minutes": preset.get("duration_minutes", 0),
                "template_key": preset.get("template_key", ""),
                "notes": preset.get("notes", ""),
                "content": preset.get("content", {}),
                "slides": [],
                "updated_at": now,
            }
            for preset in template.get("default_sections", [])
        ]
        start_dt = self._service_datetime(target_date, template["start_time"])
        tasks = []
        for preset in template.get("task_presets", []):
            due_at = (start_dt - timedelta(minutes=int(preset.get("due_offset_minutes", 0)))).isoformat()
            tasks.append(
                {
                    "id": preset["id"],
                    "role": preset["role"],
                    "scope": preset.get("scope", ""),
                    "section_ids": preset.get("section_ids", []),
                    "required_fields": preset.get("required_fields", []),
                    "status": WorshipServiceStatus.waiting.value,
                    "due_at": due_at,
                    "tips": preset.get("tips", ""),
                    "guest_access": {
                        "token_hash": None,
                        "issued_at": None,
                        "expires_at": None,
                        "revoked_at": None,
                        "last_opened_at": None,
                    },
                    "last_submitted_at": None,
                    "values": {},
                }
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
                actor_id="system",
                change_log="Materialize worship service",
                create_policies=True,
            )
        return self._sync_service(service)

    async def _ensure_calendar_materialized(self, anchor: date, days: int) -> list[dict[str, Any]]:
        half = days // 2
        start = anchor - timedelta(days=half)
        end = start + timedelta(days=days - 1)
        existing = {
            (service["date"], service["service_kind"]): service
            for service in await self.repository.list_services_between(start.isoformat(), end.isoformat())
        }
        templates = await self.repository.list_templates(active_only=True)
        created: list[dict[str, Any]] = []
        for offset in range(days):
            target = start + timedelta(days=offset)
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
            response["days"].append(
                {
                    "date": date_key,
                    "date_label": date_key,
                    "weekday_label": WEEKDAY_LABELS[target.weekday()],
                    "services": [self._sync_service(item) for item in grouped.get(date_key, [])],
                }
            )
        return WorshipCalendarResponse.model_validate(response)

    async def get_service(self, service_id: str) -> WorshipServiceDetail:
        service = await self.repository.get_service(service_id)
        return self._serialize_service(service)

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
        return self._serialize_service(await self.repository.save_service(self._sync_service(service)))

    async def update_section(self, user: dict[str, Any], service_id: str, section_id: str, payload: dict[str, Any]) -> WorshipServiceDetail:
        self._ensure_editable(user)
        service = await self.repository.get_service(service_id)
        self._ensure_version(service, payload["version"])
        section = next((item for item in service.get("sections", []) if item["id"] == section_id), None)
        if section is None:
            raise NotFoundError(f"Section '{section_id}' was not found.")
        for key in ("title", "detail", "role", "assignee_id", "assignee_name", "status", "duration_minutes", "template_key", "notes", "content", "slides"):
            if key in payload and payload[key] is not None:
                section[key] = payload[key]
        section["updated_at"] = iso_now()
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
        return self._serialize_service(await self.repository.save_service(self._sync_service(service)))

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
        return self._serialize_service(await self.repository.save_service(self._sync_service(service)))

    def _guest_expires_at(self, due_at: str | None) -> str:
        now = datetime.now(self.timezone)
        limit = now + timedelta(hours=72)
        if due_at:
            due_dt = datetime.fromisoformat(due_at)
            if due_dt < limit:
                limit = due_dt
        return limit.isoformat()

    async def issue_guest_link(self, user: dict[str, Any], service_id: str, task_id: str) -> WorshipGuestLinkResponse:
        self._ensure_editable(user)
        service = await self.repository.get_service(service_id)
        task = next((item for item in service.get("tasks", []) if item["id"] == task_id), None)
        if task is None:
            raise NotFoundError(f"Task '{task_id}' was not found.")
        token = secrets.token_urlsafe(24)
        task["guest_access"] = {
            "token_hash": self._hash_token(token),
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
        allowed_keys = {field["key"] for field in task.get("required_fields", [])}
        values = {key: value for key, value in payload.values.items() if key in allowed_keys}
        task["values"] = values
        task["last_submitted_at"] = iso_now()
        task["status"] = WorshipServiceStatus.review.value
        section_map = {section["id"]: section for section in service.get("sections", [])}
        for section_id in task.get("section_ids", []):
            section = section_map.get(section_id)
            if section is None:
                continue
            section.setdefault("content", {})
            section["content"].update(values)
            if "songTitle" in values:
                section["title"] = str(values["songTitle"])
            if "title" in values and section["section_type"] != "message":
                section["title"] = str(values["title"])
            if "noticeBody" in values:
                section["detail"] = str(values["noticeBody"])
            if "reference" in values:
                section["detail"] = str(values["reference"])
            if "lyrics" in values:
                parsed = self._parse_lyrics(str(values["lyrics"]), section.get("template_key") or "lyrics-16x9")
                section["slides"] = [slide.model_dump() for slide in parsed.slides]
            if "notes" in values:
                section["notes"] = str(values["notes"])
            section["status"] = WorshipServiceStatus.review.value
            section["updated_at"] = iso_now()
        service["metadata"]["updated_at"] = iso_now()
        service = self._sync_service(service)
        if self.udms_bridge is not None:
            service = await self.udms_bridge.sync_service_documents(
                service,
                actor_id="system",
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

    def _parse_lyrics(self, lyrics: str, template_key: str) -> WorshipLyricsParseResponse:
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
                    template_key=template_key,
                )
            )
        return WorshipLyricsParseResponse(slides=slides)

    async def parse_lyrics_for_section(
        self,
        user: dict[str, Any],
        service_id: str,
        section_id: str,
        lyrics: str,
        template_key: str,
    ) -> WorshipLyricsParseResponse:
        self._ensure_editable(user)
        await self.repository.get_service(service_id)
        return self._parse_lyrics(lyrics, template_key)

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
                        template_key=preview.get("template_key", ""),
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
                "template_key": section.get("template_key", ""),
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
            service=self._serialize_service(service),
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

    async def list_templates(self) -> list[WorshipTemplate]:
        return [WorshipTemplate.model_validate(item) for item in await self.repository.list_templates()]

    async def create_template(self, payload: WorshipTemplateUpsert) -> WorshipTemplate:
        return WorshipTemplate.model_validate(await self.repository.create_template(payload.model_dump()))

    async def update_template(self, template_id: str, payload: WorshipTemplateUpsert) -> WorshipTemplate:
        return WorshipTemplate.model_validate(
            await self.repository.update_template(template_id, payload.model_dump())
        )

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
                template_key=section.get("template_key", ""),
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
