from __future__ import annotations

from pathlib import Path

import bleach
from fastapi import UploadFile

from app.core.store import ConflictError, NotFoundError, new_id
from app.modules.udms.repository import UdmsRepository
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
    def __init__(self, repository: UdmsRepository, upload_root: str | Path, max_upload_bytes: int) -> None:
        self.repository = repository
        self.upload_root = ensure_storage_path(upload_root)
        self.max_upload_bytes = max_upload_bytes

    async def seed_defaults(self) -> None:
        await self.repository.ensure_indexes()
        await self.repository.seed_defaults_if_empty()

    def _is_master(self, user: dict) -> bool:
        return user.get("role") == "master"

    async def _board_actions(self, user: dict, board_id: str) -> set[str]:
        if self._is_master(user):
            return {"read", "create", "manage"}
        actions: set[str] = set()
        for rule in await self.repository.list_board_permissions(board_id):
            if rule["subject_type"] == "role" and rule["subject_id"] == user.get("role"):
                actions.update(rule["actions"])
            if rule["subject_type"] == "user" and rule["subject_id"] == user.get("id"):
                actions.update(rule["actions"])
            if rule["subject_type"] == "department" and rule["subject_id"] == user.get("department"):
                actions.update(rule["actions"])
        if "manage" in actions:
            actions.update({"read", "create"})
        if "create" in actions:
            actions.add("read")
        return actions

    async def _document_shares(self, document_id: str) -> list[dict]:
        return await self.repository.list_shares(document_id)

    async def _can_read_document(self, user: dict, document: dict) -> bool:
        if self._is_master(user):
            return True
        if document["created_by"] == user["id"]:
            return True
        if "read" in await self._board_actions(user, document["board_id"]):
            return True
        for share in await self._document_shares(document["id"]):
            if share["target_type"] == "user" and share["target_id"] == user["id"]:
                return True
            if share["target_type"] == "department" and share["target_id"] == user.get("department"):
                return True
        return False

    async def _can_edit_document(self, user: dict, document: dict) -> bool:
        if self._is_master(user):
            return True
        if document["status"] != "draft":
            return False
        if document["created_by"] == user["id"]:
            return True
        for share in await self._document_shares(document["id"]):
            if share["permission"] != "edit":
                continue
            if share["target_type"] == "user" and share["target_id"] == user["id"]:
                return True
            if share["target_type"] == "department" and share["target_id"] == user.get("department"):
                return True
        return False

    async def _can_manage_shares(self, user: dict, document: dict) -> bool:
        return self._is_master(user) or document["created_by"] == user["id"]

    def _sanitize_content(self, content: str) -> str:
        return bleach.clean(content, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRIBUTES, strip=True)

    async def _build_detail(self, user: dict, document: dict) -> dict:
        attachments = await self.repository.list_attachments(document["id"])
        shares = await self.repository.list_shares(document["id"]) if await self._can_manage_shares(user, document) else []
        return {**document, "attachments": attachments, "shares": shares}

    async def list_boards(self, user: dict) -> list[dict]:
        boards = await self.repository.list_boards()
        if self._is_master(user):
            return boards
        visible = []
        for board in boards:
            if "read" in await self._board_actions(user, board["id"]):
                visible.append(board)
        return visible

    async def create_board(self, payload: dict) -> dict:
        return await self.repository.create_board(payload)

    async def update_board(self, board_id: str, payload: dict) -> dict:
        return await self.repository.update_board(board_id, payload)

    async def list_board_permissions(self, user: dict) -> list[dict]:
        if not self._is_master(user):
            raise ConflictError("Only master can manage board permissions.")
        return await self.repository.list_board_permissions()

    async def set_board_permissions(self, user: dict, board_id: str, rules: list[dict]) -> list[dict]:
        if not self._is_master(user):
            raise ConflictError("Only master can manage board permissions.")
        return await self.repository.replace_board_permissions(board_id, rules)

    async def list_approval_templates(self, user: dict) -> list[dict]:
        if not user.get("id"):
            raise ConflictError("Authentication is required.")
        return await self.repository.list_approval_templates()

    async def list_documents(
        self,
        user: dict,
        board_id: str | None = None,
        status: str | None = None,
        query: str | None = None,
    ) -> list[dict]:
        documents = await self.repository.list_documents(board_id=board_id, status=status, query=query)
        visible = []
        for document in documents:
            if await self._can_read_document(user, document):
                visible.append(document)
        return visible

    async def get_document(self, user: dict, document_id: str) -> dict:
        document = await self.repository.get_document(document_id)
        if not await self._can_read_document(user, document):
            raise NotFoundError(f"Document '{document_id}' was not found.")
        return await self._build_detail(user, document)

    async def create_document(self, user: dict, payload: dict) -> dict:
        if "create" not in await self._board_actions(user, payload["board_id"]):
            raise ConflictError("You do not have permission to create documents in this board.")
        sanitized = {**payload, "content": self._sanitize_content(payload.get("content", "")), "actor_id": user["id"]}
        document = await self.repository.create_document(sanitized)
        return await self._build_detail(user, document)

    async def update_document(self, user: dict, document_id: str, payload: dict) -> dict:
        document = await self.repository.get_document(document_id)
        if not await self._can_edit_document(user, document):
            raise ConflictError("You do not have permission to edit this document.")
        sanitized = {**payload, "actor_id": user["id"]}
        if "content" in sanitized and sanitized["content"] is not None:
            sanitized["content"] = self._sanitize_content(sanitized["content"])
        updated = await self.repository.update_document(document_id, sanitized)
        return await self._build_detail(user, updated)

    async def publish_document(self, user: dict, document_id: str) -> dict:
        document = await self.repository.get_document(document_id)
        if not (self._is_master(user) or document["created_by"] == user["id"]):
            raise ConflictError("Only the author or master can publish this document.")
        published = await self.repository.publish_document(document_id, user["id"])
        return await self._build_detail(user, published)

    async def create_next_version(self, user: dict, document_id: str) -> dict:
        document = await self.repository.get_document(document_id)
        if not (self._is_master(user) or document["created_by"] == user["id"]):
            raise ConflictError("Only the author or master can create a new version.")
        created = await self.repository.create_next_version(document_id, user["id"])
        return await self._build_detail(user, created)

    async def list_versions(self, user: dict, document_id: str) -> list[dict]:
        document = await self.repository.get_document(document_id)
        if not await self._can_read_document(user, document):
            raise NotFoundError(f"Document '{document_id}' was not found.")
        return await self.repository.list_versions(document["origin_doc_id"])

    async def list_shares(self, user: dict, document_id: str) -> list[dict]:
        document = await self.repository.get_document(document_id)
        if not await self._can_manage_shares(user, document):
            raise ConflictError("Only the author or master can manage shares.")
        return await self.repository.list_shares(document_id)

    async def replace_shares(self, user: dict, document_id: str, items: list[dict]) -> list[dict]:
        document = await self.repository.get_document(document_id)
        if not await self._can_manage_shares(user, document):
            raise ConflictError("Only the author or master can manage shares.")
        return await self.repository.replace_shares(document_id, items, user["id"])

    async def list_shared_documents(self, user: dict) -> dict:
        overview = {"received": [], "sent": []}
        shares = await self.repository.list_all_shares()
        sent_document_ids = set()
        for share in shares:
            document = await self.repository.get_document(share["doc_id"])
            if document["created_by"] == user["id"]:
                sent_document_ids.add(document["id"])
                overview["sent"].append({"share": share, "document": document, "direction": "sent"})
            if share["target_type"] == "user" and share["target_id"] == user["id"]:
                overview["received"].append({"share": share, "document": document, "direction": "received"})
            if share["target_type"] == "department" and share["target_id"] == user.get("department"):
                overview["received"].append({"share": share, "document": document, "direction": "received"})
        overview["sent"].sort(key=lambda row: row["document"]["updated_at"], reverse=True)
        overview["received"].sort(key=lambda row: row["document"]["updated_at"], reverse=True)
        return overview

    async def add_attachment(self, user: dict, document_id: str, upload: UploadFile) -> dict:
        document = await self.repository.get_document(document_id)
        if not await self._can_edit_document(user, document):
            raise ConflictError("You do not have permission to edit this document.")
        content = await upload.read()
        if len(content) > self.max_upload_bytes:
            raise ConflictError("Attachment exceeds the maximum allowed size.")
        target_dir = ensure_storage_path(self.upload_root / "udms" / document["origin_doc_id"])
        storage_name = f"{new_id('file')}_{Path(upload.filename or 'attachment').name}"
        absolute_path = target_dir / storage_name
        absolute_path.write_bytes(content)
        attachment = await self.repository.create_attachment(
            document_id,
            {
                "storage_key": str(Path("udms") / document["origin_doc_id"] / storage_name),
                "file_name": upload.filename or "attachment",
                "mime_type": upload.content_type or "application/octet-stream",
                "size_bytes": len(content),
                "actor_id": user["id"],
            },
        )
        return attachment

    async def get_attachment_for_download(self, user: dict, attachment_id: str) -> tuple[dict, Path]:
        attachment = await self.repository.get_attachment(attachment_id)
        document = await self.repository.get_document(attachment["doc_id"])
        if not await self._can_read_document(user, document):
            raise NotFoundError(f"Attachment '{attachment_id}' was not found.")
        absolute_path = self.upload_root / attachment["storage_key"]
        if not absolute_path.exists():
            raise NotFoundError(f"Attachment '{attachment_id}' file was not found.")
        return attachment, absolute_path

    async def delete_attachment(self, user: dict, attachment_id: str) -> None:
        attachment = await self.repository.get_attachment(attachment_id)
        document = await self.repository.get_document(attachment["doc_id"])
        if not await self._can_edit_document(user, document):
            raise ConflictError("You do not have permission to edit this document.")
        deleted = await self.repository.delete_attachment(attachment_id)
        if await self.repository.count_attachment_refs(deleted["storage_key"]) == 0:
            absolute_path = self.upload_root / deleted["storage_key"]
            if absolute_path.exists():
                absolute_path.unlink()
