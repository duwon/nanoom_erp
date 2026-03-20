from __future__ import annotations

from copy import deepcopy
from typing import Any

from app.core.store import NotFoundError, iso_now
from app.modules.udms.repository import UdmsRepository
from app.modules.udms.schemas import DocumentEditorType, TargetPolicyAction

WORSHIP_ORDER_TARGET_TYPE = "WorshipOrder"
WORSHIP_SECTION_TARGET_TYPES = {
    "song": "SubtitleContent",
    "special_song": "SubtitleContent",
}
DEFAULT_SECTION_TARGET_TYPE = "WorshipContent"


def _section_target_type(section_type: str) -> str:
    return WORSHIP_SECTION_TARGET_TYPES.get(section_type, DEFAULT_SECTION_TARGET_TYPE)


def _order_target_policies() -> list[dict[str, Any]]:
    now = iso_now()
    policies: list[dict[str, Any]] = []
    for role in ("master", "editor", "final_approver"):
        policies.append(
            {
                "subject_type": "role",
                "subject_id": role,
                "actions": [TargetPolicyAction.read.value],
                "created_at": now,
                "updated_at": now,
            }
        )
    return policies


class WorshipUdmsBridge:
    def __init__(self, repository: UdmsRepository) -> None:
        self.repository = repository

    async def reset(self) -> None:
        await self.repository.delete_documents_by_target_types(
            [WORSHIP_ORDER_TARGET_TYPE, DEFAULT_SECTION_TARGET_TYPE, "SubtitleContent"]
        )
        await self.repository.delete_target_policies_by_target_types(
            [WORSHIP_ORDER_TARGET_TYPE, DEFAULT_SECTION_TARGET_TYPE, "SubtitleContent"]
        )

    def _service_meta(self, service: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": service["id"],
            "date": service["date"],
            "service_kind": service["service_kind"],
            "service_name": service["service_name"],
            "start_at": service["start_at"],
            "summary": service.get("summary", ""),
            "template_id": service["template_id"],
            "status": service.get("status", ""),
            "version": int(service.get("version", 1)),
        }

    def _task_defs(self, service: dict[str, Any]) -> list[dict[str, Any]]:
        defs: list[dict[str, Any]] = []
        for task in service.get("tasks", []):
            defs.append(
                {
                    "id": task["id"],
                    "section_id": task.get("section_id"),
                    "role": task["role"],
                    "scope": task.get("scope", ""),
                    "required_fields": deepcopy(task.get("required_fields", [])),
                    "status": task.get("status", ""),
                    "due_at": task.get("due_at"),
                    "tips": task.get("tips", ""),
                }
            )
        return defs

    def _section_refs(self, service: dict[str, Any], section_doc_ids: dict[str, str]) -> dict[str, dict[str, Any]]:
        refs: dict[str, dict[str, Any]] = {}
        for section in service.get("sections", []):
            refs[section["id"]] = {
                "document_id": section_doc_ids.get(section["id"]),
                "section_type": section["section_type"],
                "title": section["title"],
                "order": section["order"],
            }
        return refs

    def _order_module_data(self, service: dict[str, Any], section_doc_ids: dict[str, str]) -> dict[str, Any]:
        sections = sorted(service.get("sections", []), key=lambda item: item["order"])
        return {
            "service_meta": self._service_meta(service),
            "section_order": [section["id"] for section in sections],
            "task_defs": self._task_defs(service),
            "section_refs": self._section_refs(service, section_doc_ids),
        }

    def _section_module_data(self, service: dict[str, Any], section: dict[str, Any]) -> dict[str, Any]:
        return {
            "service_id": service["id"],
            "section_id": section["id"],
            "section_type": section["section_type"],
            "title": section["title"],
            "detail": section.get("detail", ""),
            "role": section.get("role", ""),
            "assignee": {
                "id": section.get("assignee_id"),
                "name": section.get("assignee_name"),
            },
            "status": section.get("status", ""),
            "duration_minutes": section.get("duration_minutes", 0),
            "template_key": section.get("template_key", ""),
            "notes": section.get("notes", ""),
            "content": deepcopy(section.get("content", {})),
            "slides": deepcopy(section.get("slides", [])),
            "updated_at": section.get("updated_at"),
        }

    async def _publish_document(self, document_id: str, actor_id: str) -> dict[str, Any]:
        return await self.repository.publish_document(document_id, actor_id)

    async def _upsert_document(
        self,
        *,
        document_id: str | None,
        actor_id: str,
        target_type: str,
        target_id: str,
        title: str,
        body: str,
        module_data: dict[str, Any],
        change_log: str,
    ) -> dict[str, Any]:
        creation_payload = {
            "title": title,
            "body": body,
            "editor_type": DocumentEditorType.tiptap.value,
            "module_data": module_data,
            "target_type": target_type,
            "target_id": target_id,
            "deep_link": f"/worship?serviceId={target_id}",
            "change_log": change_log,
            "actor_id": actor_id,
            "category": "Worship",
            "tags": ["worship", target_type.lower()],
        }
        update_payload = {
            "title": title,
            "body": body,
            "editor_type": DocumentEditorType.tiptap.value,
            "module_data": module_data,
            "actor_id": actor_id,
            "category": "Worship",
            "tags": ["worship", target_type.lower()],
        }
        if document_id is None:
            created = await self.repository.create_document(creation_payload)
            return await self._publish_document(created["id"], actor_id)

        try:
            await self.repository.get_document(document_id)
        except NotFoundError:
            created = await self.repository.create_document({**creation_payload, "id": document_id})
            return await self._publish_document(created["id"], actor_id)

        return await self.repository.publish_updated_document(document_id, update_payload, actor_id)

    async def sync_service_documents(
        self,
        service: dict[str, Any],
        *,
        actor_id: str,
        change_log: str,
        create_policies: bool = False,
    ) -> dict[str, Any]:
        next_service = deepcopy(service)
        section_doc_ids = dict(next_service.get("section_document_ids", {}))
        for section in next_service.get("sections", []):
            section_doc = await self._upsert_document(
                document_id=section_doc_ids.get(section["id"]),
                actor_id=actor_id,
                target_type=_section_target_type(section["section_type"]),
                target_id=next_service["id"],
                title=section["title"],
                body=section.get("detail") or section["title"],
                module_data=self._section_module_data(next_service, section),
                change_log=change_log,
            )
            section_doc_ids[section["id"]] = section_doc["id"]

        order_document = await self._upsert_document(
            document_id=next_service.get("order_document_id"),
            actor_id=actor_id,
            target_type=WORSHIP_ORDER_TARGET_TYPE,
            target_id=next_service["id"],
            title=next_service["service_name"],
            body=next_service.get("summary", "") or next_service["service_name"],
            module_data=self._order_module_data(next_service, section_doc_ids),
            change_log=change_log,
        )
        if create_policies:
            await self.repository.replace_target_policies(
                WORSHIP_ORDER_TARGET_TYPE,
                next_service["id"],
                _order_target_policies(),
            )

        next_service["section_document_ids"] = section_doc_ids
        next_service["order_document_id"] = order_document["id"]
        next_service["task_guest_access"] = {
            task["id"]: deepcopy(task.get("guest_access", {})) for task in next_service.get("tasks", [])
        }
        next_service["version"] = int(order_document["metadata"]["version"])
        next_service["metadata"]["updated_at"] = iso_now()
        next_service["metadata"].setdefault("created_at", iso_now())
        return next_service

    async def touch_order_document(self, service: dict[str, Any], *, actor_id: str, change_log: str) -> dict[str, Any]:
        next_service = deepcopy(service)
        order_document = await self._upsert_document(
            document_id=next_service.get("order_document_id"),
            actor_id=actor_id,
            target_type=WORSHIP_ORDER_TARGET_TYPE,
            target_id=next_service["id"],
            title=next_service["service_name"],
            body=next_service.get("summary", "") or next_service["service_name"],
            module_data=self._order_module_data(next_service, dict(next_service.get("section_document_ids", {}))),
            change_log=change_log,
        )
        next_service["order_document_id"] = order_document["id"]
        next_service["version"] = int(order_document["metadata"]["version"])
        next_service["metadata"]["updated_at"] = iso_now()
        return next_service
