from __future__ import annotations

from pathlib import Path
from typing import Any

import bleach
from fastapi import UploadFile

from app.core.store import ConflictError, NotFoundError, new_id
from app.modules.udms.repository import UdmsRepository
from app.modules.udms.schemas import (
    DocumentAclAction,
    DocumentAclEffect,
    DocumentStatus,
    PermissionSubjectType,
    TargetPolicyAction,
)
from app.modules.udms.targets import TargetDescriptor, TargetRegistry
from app.storage.files import ensure_storage_path

ALLOWED_TAGS = [
    "a",
    "blockquote",
    "br",
    "code",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "li",
    "ol",
    "p",
    "pre",
    "strong",
    "table",
    "tbody",
    "td",
    "th",
    "thead",
    "tr",
    "ul",
]

ALLOWED_ATTRIBUTES = {
    "a": ["href", "target", "rel"],
    "td": ["colspan", "rowspan"],
    "th": ["colspan", "rowspan"],
}


class UdmsService:
    def __init__(
        self,
        repository: UdmsRepository,
        upload_root: str | Path,
        max_upload_bytes: int,
        registry: TargetRegistry,
    ) -> None:
        self.repository = repository
        self.upload_root = ensure_storage_path(upload_root)
        self.max_upload_bytes = max_upload_bytes
        self.registry = registry

    async def seed_defaults(self) -> None:
        await self.repository.ensure_indexes()
        await self.repository.seed_defaults_if_empty()

    def _is_master(self, user: dict[str, Any]) -> bool:
        return user.get("role") == "master"

    def _matches_subject(self, user: dict[str, Any], subject_type: str, subject_id: str) -> bool:
        if subject_type == PermissionSubjectType.role.value:
            return user.get("role") == subject_id
        if subject_type == PermissionSubjectType.user.value:
            return user.get("id") == subject_id
        if subject_type == PermissionSubjectType.department.value:
            return user.get("department") == subject_id
        return False

    def _expand_target_actions(self, actions: set[str]) -> set[str]:
        expanded = set(actions)
        if TargetPolicyAction.manage.value in expanded:
            expanded.update({TargetPolicyAction.read.value, TargetPolicyAction.create.value})
        if TargetPolicyAction.create.value in expanded:
            expanded.add(TargetPolicyAction.read.value)
        return expanded

    def _expand_document_actions(self, actions: set[str]) -> set[str]:
        expanded = set(actions)
        if DocumentAclAction.manage.value in expanded:
            expanded.update(
                {
                    DocumentAclAction.read.value,
                    DocumentAclAction.edit.value,
                    DocumentAclAction.publish.value,
                }
            )
        if DocumentAclAction.publish.value in expanded:
            expanded.update({DocumentAclAction.read.value, DocumentAclAction.edit.value})
        if DocumentAclAction.edit.value in expanded:
            expanded.add(DocumentAclAction.read.value)
        return expanded

    def _sanitize_content(self, content: str) -> str:
        return bleach.clean(content, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRIBUTES, strip=True)

    async def _target_actions(self, user: dict[str, Any], target_type: str, target_id: str) -> set[str]:
        if self._is_master(user):
            return self._expand_target_actions(
                {
                    TargetPolicyAction.read.value,
                    TargetPolicyAction.create.value,
                    TargetPolicyAction.manage.value,
                }
            )
        actions: set[str] = set()
        for rule in await self.repository.list_target_policies(target_type=target_type, target_id=target_id):
            if self._matches_subject(user, rule["subject_type"], rule["subject_id"]):
                actions.update(rule["actions"])
        return self._expand_target_actions(actions)

    async def _document_actions(self, user: dict[str, Any], root: dict[str, Any]) -> set[str]:
        if self._is_master(user):
            return self._expand_document_actions(
                {
                    DocumentAclAction.read.value,
                    DocumentAclAction.edit.value,
                    DocumentAclAction.manage.value,
                    DocumentAclAction.publish.value,
                }
            )
        actions: set[str] = set()
        if root["created_by"] == user.get("id"):
            actions.update(
                self._expand_document_actions(
                    {
                        DocumentAclAction.read.value,
                        DocumentAclAction.edit.value,
                        DocumentAclAction.manage.value,
                        DocumentAclAction.publish.value,
                    }
                )
            )
        target_actions = await self._target_actions(user, root["link"]["target_type"], root["link"]["target_id"])
        if root["published_revision_id"] is not None and TargetPolicyAction.read.value in target_actions:
            actions.add(DocumentAclAction.read.value)

        denied: set[str] = set()
        for rule in root["security"].get("acl", []):
            if not self._matches_subject(user, rule["subject_type"], rule["subject_id"]):
                continue
            expanded = self._expand_document_actions(set(rule["actions"]))
            if rule.get("effect") == DocumentAclEffect.deny.value:
                denied.update(expanded)
            else:
                actions.update(expanded)

        actions -= denied
        if root["state"]["status"] in {DocumentStatus.locked.value, DocumentStatus.archived.value}:
            actions.discard(DocumentAclAction.edit.value)
            actions.discard(DocumentAclAction.publish.value)
            actions.discard(DocumentAclAction.manage.value)
        return self._expand_document_actions(actions)

    async def _can_read_document(self, user: dict[str, Any], root: dict[str, Any]) -> bool:
        actions = await self._document_actions(user, root)
        return DocumentAclAction.read.value in actions

    async def _can_edit_working_copy(self, user: dict[str, Any], root: dict[str, Any]) -> bool:
        actions = await self._document_actions(user, root)
        return root["state"]["status"] not in {DocumentStatus.locked.value, DocumentStatus.archived.value} and (
            DocumentAclAction.edit.value in actions or DocumentAclAction.manage.value in actions
        )

    async def _can_manage_security(self, user: dict[str, Any], root: dict[str, Any]) -> bool:
        if root["state"]["status"] in {DocumentStatus.locked.value, DocumentStatus.archived.value}:
            return self._is_master(user)
        actions = await self._document_actions(user, root)
        return DocumentAclAction.manage.value in actions

    async def _can_publish(self, user: dict[str, Any], root: dict[str, Any]) -> bool:
        actions = await self._document_actions(user, root)
        return root["state"]["status"] not in {DocumentStatus.locked.value, DocumentStatus.archived.value} and (
            DocumentAclAction.publish.value in actions or DocumentAclAction.manage.value in actions
        )

    def _security_summary(self, root: dict[str, Any]) -> dict[str, Any]:
        acl = root["security"].get("acl", [])
        external = root["security"].get("external_shares", [])
        return {
            "acl_count": len(acl),
            "external_share_count": len(external),
            "has_deny_rules": any(rule.get("effect") == DocumentAclEffect.deny.value for rule in acl),
        }

    async def _build_revision_view(
        self,
        root: dict[str, Any],
        revision_id: str | None,
        *,
        include_body: bool,
    ) -> dict[str, Any] | None:
        if revision_id is None:
            return None
        revision = await self.repository.get_revision(revision_id)
        return {
            **revision,
            "body": revision["body"] if include_body else None,
            "is_current": revision_id == root.get("working_revision_id") or (
                revision_id == root.get("published_revision_id") and root.get("working_revision_id") is None
            ),
            "is_published": revision_id == root.get("published_revision_id"),
        }

    async def _visible_revision_ids(self, user: dict[str, Any], root: dict[str, Any]) -> tuple[str | None, str | None, str | None]:
        actions = await self._document_actions(user, root)
        published_id = root.get("published_revision_id")
        working_id = root.get("working_revision_id")
        if published_id is None:
            return working_id, None, working_id
        if working_id is not None and (
            DocumentAclAction.edit.value in actions
            or DocumentAclAction.manage.value in actions
            or DocumentAclAction.publish.value in actions
        ):
            return working_id, published_id, working_id
        return published_id, published_id, None

    async def _build_document_payload(self, user: dict[str, Any], root: dict[str, Any], *, detail: bool) -> dict[str, Any]:
        current_id, published_id, working_id = await self._visible_revision_ids(user, root)
        if current_id is None:
            raise NotFoundError(f"Document '{root['id']}' has no visible revision.")
        current_revision = await self._build_revision_view(root, current_id, include_body=detail)
        published_revision = await self._build_revision_view(root, published_id, include_body=detail)
        working_revision = await self._build_revision_view(root, working_id, include_body=detail)
        actions = await self._document_actions(user, root)
        payload = {
            "id": root["id"],
            "header": current_revision["header"],
            "link": root["link"],
            "state": root["state"],
            "metadata": root["metadata"],
            "current_revision": current_revision,
            "published_revision": published_revision,
            "working_revision": working_revision,
            "security_summary": self._security_summary(root),
            "module_data": current_revision.get("module_data", {}),
            "capabilities": {
                "effective_actions": sorted(actions),
                "can_read": DocumentAclAction.read.value in actions,
                "can_edit_working_copy": await self._can_edit_working_copy(user, root),
                "can_publish": await self._can_publish(user, root),
                "can_manage_security": await self._can_manage_security(user, root),
                "can_create_working_copy": root.get("published_revision_id") is not None
                and root.get("working_revision_id") is None
                and await self._can_edit_working_copy(user, root),
            },
        }
        if detail:
            payload["security"] = (
                root["security"]
                if await self._can_manage_security(user, root)
                else {"acl": [], "external_shares": []}
            )
        return payload

    def _get_target_descriptor(self, target_type: str) -> TargetDescriptor:
        normalized_target_type = target_type.strip()
        if not normalized_target_type:
            raise ConflictError("Target type must not be blank.")
        try:
            return self.registry.get_target_descriptor(normalized_target_type)
        except KeyError as error:
            raise ConflictError(f"Target type '{normalized_target_type}' is not registered.") from error

    async def _ensure_target_registered(self, target_type: str) -> TargetDescriptor:
        return self._get_target_descriptor(target_type)

    async def _ensure_target_for_write(self, target_type: str, target_id: str) -> TargetDescriptor:
        descriptor = self._get_target_descriptor(target_type)
        if not descriptor.is_enabled:
            raise ConflictError(f"Target type '{descriptor.target_type}' is disabled.")
        if descriptor.requires_existing_parent and descriptor.parent_validator is not None:
            await descriptor.parent_validator(target_id)
        return descriptor

    def _is_public_document_root(self, root: dict[str, Any]) -> bool:
        try:
            descriptor = self.registry.get_target_descriptor(root["link"]["target_type"])
        except KeyError:
            return False
        return descriptor.is_enabled

    async def list_target_types(self) -> list[dict[str, Any]]:
        return [
            {
                "target_type": descriptor.target_type,
                "label": descriptor.label,
                "namespace": descriptor.namespace,
                "deep_link_template": descriptor.deep_link_template,
                "requires_existing_parent": descriptor.requires_existing_parent,
                "document_title_hint": descriptor.document_title_hint,
                "is_enabled": descriptor.is_enabled,
            }
            for descriptor in self.registry.list_registered_targets()
        ]

    async def list_boards(self, user: dict[str, Any]) -> list[dict[str, Any]]:
        boards = await self.repository.list_boards()
        if self._is_master(user):
            return boards
        visible = []
        for board in boards:
            actions = await self._target_actions(user, "Board", board["id"])
            if TargetPolicyAction.read.value in actions:
                visible.append(board)
        return visible

    async def create_board(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self.repository.create_board(payload)

    async def update_board(self, board_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        return await self.repository.update_board(board_id, payload)

    async def list_approval_templates(self, user: dict[str, Any]) -> list[dict[str, Any]]:
        if not user.get("id"):
            raise ConflictError("Authentication is required.")
        return await self.repository.list_approval_templates()

    async def list_target_policies(self, user: dict[str, Any], target_type: str | None = None, target_id: str | None = None) -> list[dict[str, Any]]:
        if not self._is_master(user):
            raise ConflictError("Only master can manage target policies.")
        if target_type:
            await self._ensure_target_registered(target_type)
        return await self.repository.list_target_policies(target_type=target_type, target_id=target_id)

    async def replace_target_policies(self, user: dict[str, Any], target_type: str, target_id: str, rules: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not self._is_master(user):
            raise ConflictError("Only master can manage target policies.")
        await self._ensure_target_for_write(target_type, target_id)
        return await self.repository.replace_target_policies(target_type, target_id, rules)

    async def list_documents(
        self,
        user: dict[str, Any],
        *,
        target_type: str | None = None,
        target_id: str | None = None,
        status: str | None = None,
        query: str | None = None,
        author_id: str | None = None,
    ) -> list[dict[str, Any]]:
        if target_type:
            await self._ensure_target_registered(target_type)
        documents = await self.repository.list_documents(target_type=target_type, target_id=target_id, status=status, author_id=author_id)
        visible: list[dict[str, Any]] = []
        lowered = (query or "").strip().lower()
        for root in documents:
            if not self._is_public_document_root(root):
                continue
            if not await self._can_read_document(user, root):
                continue
            payload = await self._build_document_payload(user, root, detail=False)
            if lowered:
                haystacks = [
                    payload["header"]["title"],
                    payload["current_revision"]["summary"],
                    " ".join(payload["header"].get("tags", [])),
                ]
                if lowered not in " ".join(haystacks).lower():
                    continue
            visible.append(payload)
        return visible

    async def get_document(self, user: dict[str, Any], document_id: str) -> dict[str, Any]:
        root = await self.repository.get_document(document_id)
        if not self._is_public_document_root(root):
            raise NotFoundError(f"Document '{document_id}' was not found.")
        if not await self._can_read_document(user, root):
            raise NotFoundError(f"Document '{document_id}' was not found.")
        return await self._build_document_payload(user, root, detail=True)

    async def create_document(self, user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
        descriptor = await self._ensure_target_for_write(payload["target_type"], payload["target_id"])
        actions = await self._target_actions(user, payload["target_type"], payload["target_id"])
        if TargetPolicyAction.create.value not in actions and not self._is_master(user):
            raise ConflictError("You do not have permission to create documents in this target.")
        sanitized = {
            **payload,
            "body": self._sanitize_content(payload.get("body", "")),
            "actor_id": user["id"],
            "target_type": payload["target_type"],
            "target_id": payload["target_id"],
            "deep_link": self.registry.build_deep_link(descriptor.target_type, payload["target_id"]),
        }
        root = await self.repository.create_document(sanitized)
        await self.repository.append_audit_entry(
            action="document.created",
            target_type=root["link"]["target_type"],
            target_id=root["id"],
            actor_id=user["id"],
            detail=root["header"]["title"],
        )
        return await self._build_document_payload(user, root, detail=True)

    async def update_working_copy(self, user: dict[str, Any], document_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        root = await self.repository.get_document(document_id)
        if not await self._can_edit_working_copy(user, root):
            raise ConflictError("You do not have permission to edit this document.")
        next_target_type = payload.get("target_type", root["link"]["target_type"])
        next_target_id = payload.get("target_id", root["link"]["target_id"])
        descriptor = await self._ensure_target_for_write(next_target_type, next_target_id)
        sanitized = {
            **payload,
            "actor_id": user["id"],
            "deep_link": self.registry.build_deep_link(descriptor.target_type, next_target_id),
        }
        if "body" in sanitized and sanitized["body"] is not None:
            sanitized["body"] = self._sanitize_content(sanitized["body"])
        updated = await self.repository.update_working_copy(document_id, sanitized)
        await self.repository.append_audit_entry(
            action="document.updated",
            target_type=updated["link"]["target_type"],
            target_id=updated["id"],
            actor_id=user["id"],
            detail=payload.get("change_log", ""),
        )
        return await self._build_document_payload(user, updated, detail=True)

    async def create_working_copy(self, user: dict[str, Any], document_id: str) -> dict[str, Any]:
        root = await self.repository.get_document(document_id)
        if not await self._can_edit_working_copy(user, root):
            raise ConflictError("You do not have permission to create a working copy.")
        created = await self.repository.create_working_copy(document_id, user["id"])
        await self.repository.append_audit_entry(
            action="document.working_copy.created",
            target_type=created["link"]["target_type"],
            target_id=created["id"],
            actor_id=user["id"],
            detail="Create working copy",
        )
        return await self._build_document_payload(user, created, detail=True)

    async def publish_document(self, user: dict[str, Any], document_id: str) -> dict[str, Any]:
        root = await self.repository.get_document(document_id)
        if not await self._can_publish(user, root):
            raise ConflictError("You do not have permission to publish this document.")
        published = await self.repository.publish_document(document_id, user["id"])
        await self.repository.append_audit_entry(
            action="document.published",
            target_type=published["link"]["target_type"],
            target_id=published["id"],
            actor_id=user["id"],
            detail=published["header"]["title"],
        )
        return await self._build_document_payload(user, published, detail=True)

    async def rollback_document(self, user: dict[str, Any], document_id: str, target_version: int) -> dict[str, Any]:
        root = await self.repository.get_document(document_id)
        if not await self._can_edit_working_copy(user, root):
            raise ConflictError("You do not have permission to rollback this document.")
        rolled_back = await self.repository.rollback_document(document_id, target_version, user["id"])
        await self.repository.append_audit_entry(
            action="document.rolled_back",
            target_type=rolled_back["link"]["target_type"],
            target_id=rolled_back["id"],
            actor_id=user["id"],
            detail=f"Rollback to version {target_version}",
        )
        return await self._build_document_payload(user, rolled_back, detail=True)

    async def list_revisions(self, user: dict[str, Any], document_id: str) -> list[dict[str, Any]]:
        root = await self.repository.get_document(document_id)
        if not await self._can_read_document(user, root):
            raise NotFoundError(f"Document '{document_id}' was not found.")
        current_id, _published_id, working_id = await self._visible_revision_ids(user, root)
        revisions = await self.repository.list_revisions(document_id)
        rows: list[dict[str, Any]] = []
        for revision in revisions:
            if working_id is None and revision["id"] == root.get("working_revision_id"):
                continue
            rows.append(
                {
                    **revision,
                    "body": None,
                    "is_current": revision["id"] == current_id,
                    "is_published": revision["id"] == root.get("published_revision_id"),
                }
            )
        return rows

    async def replace_document_security(self, user: dict[str, Any], document_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        root = await self.repository.get_document(document_id)
        if not await self._can_manage_security(user, root):
            raise ConflictError("You do not have permission to manage document security.")
        updated = await self.repository.replace_document_security(document_id, payload, user["id"])
        await self.repository.append_audit_entry(
            action="document.security.updated",
            target_type=updated["link"]["target_type"],
            target_id=updated["id"],
            actor_id=user["id"],
            detail=f"ACL {len(payload.get('acl', []))} rules",
        )
        return await self._build_document_payload(user, updated, detail=True)

    async def create_external_share(self, user: dict[str, Any], document_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        root = await self.repository.get_document(document_id)
        if not await self._can_manage_security(user, root):
            raise ConflictError("You do not have permission to manage external shares.")
        updated = await self.repository.create_external_share(document_id, payload, user["id"])
        return await self._build_document_payload(user, updated, detail=True)

    async def delete_external_share(self, user: dict[str, Any], document_id: str, share_id: str) -> dict[str, Any]:
        root = await self.repository.get_document(document_id)
        if not await self._can_manage_security(user, root):
            raise ConflictError("You do not have permission to manage external shares.")
        updated = await self.repository.delete_external_share(document_id, share_id, user["id"])
        return await self._build_document_payload(user, updated, detail=True)

    async def list_shared_documents(self, user: dict[str, Any]) -> dict[str, Any]:
        overview = {"accessible": [], "external_links": []}
        for root in await self.repository.list_documents():
            if not self._is_public_document_root(root):
                continue
            acl_sources = []
            for rule in root["security"].get("acl", []):
                if rule.get("effect") == DocumentAclEffect.deny.value:
                    continue
                if self._matches_subject(user, rule["subject_type"], rule["subject_id"]):
                    acl_sources.append(f"acl:{rule['subject_type']}")
            if acl_sources and await self._can_read_document(user, root):
                overview["accessible"].append(
                    {
                        "document": await self._build_document_payload(user, root, detail=False),
                        "access_source": acl_sources[0],
                    }
                )
            if (root["created_by"] == user.get("id") or self._is_master(user)) and root["security"].get("external_shares"):
                for link in root["security"]["external_shares"]:
                    overview["external_links"].append(
                        {
                            "document_id": root["id"],
                            "document_title": root["header"]["title"],
                            "link": link,
                            "target_type": root["link"]["target_type"],
                            "target_id": root["link"]["target_id"],
                        }
                    )
        return overview

    async def add_attachment(self, user: dict[str, Any], document_id: str, upload: UploadFile) -> dict[str, Any]:
        root = await self.repository.get_document(document_id)
        if not await self._can_edit_working_copy(user, root):
            raise ConflictError("You do not have permission to edit this document.")
        if root.get("working_revision_id") is None:
            raise ConflictError("Create a working copy before uploading files.")
        content = await upload.read()
        if len(content) > self.max_upload_bytes:
            raise ConflictError("Attachment exceeds the maximum allowed size.")
        namespace = self._get_target_descriptor(root["link"]["target_type"]).namespace
        next_version = int(root["metadata"]["version"]) + 1
        attachment_id = new_id("file")
        extension = Path(upload.filename or "attachment").suffix
        storage_key = str(
            Path(namespace)
            / root["link"]["target_id"]
            / root["id"]
            / f"{attachment_id}_v{next_version}{extension}"
        )
        absolute_path = self.upload_root / storage_key
        ensure_storage_path(absolute_path.parent)
        absolute_path.write_bytes(content)
        current_detail = await self.get_document(user, document_id)
        attachments = list(current_detail["current_revision"]["attachments"])
        attachment = {
            "id": attachment_id,
            "file_name": upload.filename or "attachment",
            "mime_type": upload.content_type or "application/octet-stream",
            "size_bytes": len(content),
            "storage_key": storage_key,
            "version": next_version,
            "created_by": user["id"],
            "created_at": current_detail["metadata"]["updated_at"],
            "updated_at": current_detail["metadata"]["updated_at"],
        }
        attachments.append(attachment)
        await self.repository.replace_working_attachments(document_id, attachments, "Attachment upload", user["id"])
        return attachment

    async def get_attachment_for_download(self, user: dict[str, Any], attachment_id: str) -> tuple[dict[str, Any], Path]:
        root, _revision, attachment = await self.repository.find_attachment(attachment_id)
        if not await self._can_read_document(user, root):
            raise NotFoundError(f"Attachment '{attachment_id}' was not found.")
        absolute_path = self.upload_root / attachment["storage_key"]
        if not absolute_path.exists():
            raise NotFoundError(f"Attachment '{attachment_id}' file was not found.")
        return attachment, absolute_path

    async def delete_attachment(self, user: dict[str, Any], attachment_id: str) -> None:
        root, _revision, attachment = await self.repository.find_attachment(attachment_id)
        if not await self._can_edit_working_copy(user, root):
            raise ConflictError("You do not have permission to edit this document.")
        detail = await self.get_document(user, root["id"])
        current_attachments = detail["current_revision"]["attachments"]
        if not any(item["id"] == attachment_id for item in current_attachments):
            raise ConflictError("Only attachments on the current working revision can be removed.")
        next_attachments = [item for item in current_attachments if item["id"] != attachment_id]
        await self.repository.replace_working_attachments(root["id"], next_attachments, "Attachment removed", user["id"])
        if await self.repository.count_storage_refs(attachment["storage_key"]) == 0:
            absolute_path = self.upload_root / attachment["storage_key"]
            if absolute_path.exists():
                absolute_path.unlink()

    async def lock_approval_documents(self, user: dict[str, Any], *, document_id: str | None = None, target_id: str | None = None) -> list[dict[str, Any]]:
        locked = []
        if document_id:
            root = await self.repository.lock_document(document_id, user["id"])
            locked.append(await self._build_document_payload(user, root, detail=False))
            return locked
        if target_id is None:
            raise ConflictError("document_id or target_id is required.")
        for root in await self.repository.lock_documents_for_target("Approval", target_id, user["id"]):
            locked.append(await self._build_document_payload(user, root, detail=False))
        return locked

    async def handle_parent_deleted(self, user: dict[str, Any], *, target_type: str, target_id: str, policy: str) -> list[dict[str, Any]]:
        await self._ensure_target_registered(target_type)
        updated = await self.repository.handle_parent_deleted(target_type, target_id, policy, user["id"])
        return [await self._build_document_payload(user, root, detail=False) for root in updated]
