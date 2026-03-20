from __future__ import annotations

import re
from copy import deepcopy
from typing import Any, Protocol

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING

from app.core.store import ConflictError, NotFoundError, iso_now, new_id
from app.modules.udms.schemas import (
    DocumentAclAction,
    DocumentAclEffect,
    DocumentEditorType,
    DocumentStatus,
    PermissionSubjectType,
    TargetPolicyAction,
)

DEFAULT_BOARD_ID = "board-notice"
DEFAULT_DOC_ID = "doc-worship-guide"


def _plain_text_summary(body: str) -> str:
    text = re.sub(r"<[^>]+>", " ", body)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:240]


def _seed_board(now: str) -> dict[str, Any]:
    return {
        "id": DEFAULT_BOARD_ID,
        "name": "공지사항",
        "description": "교회 공지 및 안내 문서를 관리합니다.",
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }


def _seed_approval_templates(now: str) -> list[dict[str, Any]]:
    return [
        {
            "id": "approval-general",
            "name": "일반 공문",
            "description": "공지와 일반 문서에 사용하는 기본 템플릿",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": "approval-budget",
            "name": "지출 결의",
            "description": "예산 및 지출 검토용 템플릿",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        },
    ]


def _seed_document_bundle(now: str) -> tuple[dict[str, Any], dict[str, Any]]:
    revision_id = "rev-worship-guide-v1"
    revision = {
        "id": revision_id,
        "document_id": DEFAULT_DOC_ID,
        "version": 1,
        "header": {
            "title": "주일 예배 순서",
            "category": "Guide",
            "tags": ["worship", "guide"],
            "author_id": "system",
        },
        "body": "<p>예배 순서와 자막, 첨부파일을 관리하는 문서입니다.</p>",
        "summary": "예배 순서와 자막, 첨부파일을 관리하는 문서입니다.",
        "editor_type": DocumentEditorType.tiptap.value,
        "attachments": [],
        "module_data": {},
        "change_log": "Initial seed",
        "created_by": "system",
        "created_at": now,
    }
    root = {
        "id": DEFAULT_DOC_ID,
        "header": deepcopy(revision["header"]),
        "link": {
            "target_type": "Board",
            "target_id": DEFAULT_BOARD_ID,
            "deep_link": f"/udms/boards?targetId={DEFAULT_BOARD_ID}",
        },
        "state": {"status": DocumentStatus.published.value},
        "security": {"acl": [], "external_shares": []},
        "module_data": {},
        "metadata": {
            "version": 1,
            "is_deleted": False,
            "archived_at": None,
            "created_at": now,
            "updated_at": now,
        },
        "published_revision_id": revision_id,
        "working_revision_id": None,
        "created_by": "system",
        "updated_by": "system",
    }
    return root, revision


def _seed_target_policies(now: str) -> list[dict[str, Any]]:
    return [
        {
            "id": "policy-board-master",
            "target_type": "Board",
            "target_id": DEFAULT_BOARD_ID,
            "subject_type": PermissionSubjectType.role.value,
            "subject_id": "master",
            "actions": [TargetPolicyAction.read.value, TargetPolicyAction.create.value, TargetPolicyAction.manage.value],
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": "policy-board-editor",
            "target_type": "Board",
            "target_id": DEFAULT_BOARD_ID,
            "subject_type": PermissionSubjectType.role.value,
            "subject_id": "editor",
            "actions": [TargetPolicyAction.read.value, TargetPolicyAction.create.value],
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": "policy-board-member",
            "target_type": "Board",
            "target_id": DEFAULT_BOARD_ID,
            "subject_type": PermissionSubjectType.role.value,
            "subject_id": "member",
            "actions": [TargetPolicyAction.read.value],
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": "policy-board-approver",
            "target_type": "Board",
            "target_id": DEFAULT_BOARD_ID,
            "subject_type": PermissionSubjectType.role.value,
            "subject_id": "final_approver",
            "actions": [TargetPolicyAction.read.value],
            "created_at": now,
            "updated_at": now,
        },
    ]


def _create_initial_revision(
    *,
    document_id: str,
    actor_id: str,
    header: dict[str, Any],
    body: str,
    editor_type: str,
    module_data: dict[str, Any],
    change_log: str,
) -> dict[str, Any]:
    now = iso_now()
    return {
        "id": new_id("rev"),
        "document_id": document_id,
        "version": 1,
        "header": deepcopy(header),
        "body": body,
        "summary": _plain_text_summary(body),
        "editor_type": editor_type,
        "attachments": [],
        "module_data": deepcopy(module_data),
        "change_log": change_log,
        "created_by": actor_id,
        "created_at": now,
    }


def _create_document_bundle(payload: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    document_id = payload.get("id") or new_id("doc")
    actor_id = payload["actor_id"]
    header = {
        "title": payload["title"],
        "category": payload.get("category", ""),
        "tags": payload.get("tags", []),
        "author_id": actor_id,
    }
    revision = _create_initial_revision(
        document_id=document_id,
        actor_id=actor_id,
        header=header,
        body=payload.get("body", ""),
        editor_type=payload.get("editor_type", DocumentEditorType.tiptap.value),
        module_data=payload.get("module_data", {}),
        change_log=payload.get("change_log", ""),
    )
    now = revision["created_at"]
    root = {
        "id": document_id,
        "header": deepcopy(header),
        "link": {
            "target_type": payload["target_type"],
            "target_id": payload["target_id"],
            "deep_link": payload["deep_link"],
        },
        "state": {"status": DocumentStatus.draft.value},
        "security": {"acl": [], "external_shares": []},
        "module_data": deepcopy(payload.get("module_data", {})),
        "metadata": {
            "version": 1,
            "is_deleted": False,
            "archived_at": None,
            "created_at": now,
            "updated_at": now,
        },
        "published_revision_id": None,
        "working_revision_id": revision["id"],
        "created_by": actor_id,
        "updated_by": actor_id,
    }
    return root, revision


def _clone_revision(
    root: dict[str, Any],
    base_revision: dict[str, Any],
    *,
    actor_id: str,
    header: dict[str, Any] | None = None,
    body: str | None = None,
    attachments: list[dict[str, Any]] | None = None,
    module_data: dict[str, Any] | None = None,
    editor_type: str | None = None,
    change_log: str = "",
) -> tuple[dict[str, Any], dict[str, Any]]:
    now = iso_now()
    next_version = int(root["metadata"]["version"]) + 1
    next_revision = {
        "id": new_id("rev"),
        "document_id": root["id"],
        "version": next_version,
        "header": deepcopy(header if header is not None else base_revision["header"]),
        "body": body if body is not None else base_revision["body"],
        "summary": _plain_text_summary(body if body is not None else base_revision["body"]),
        "editor_type": editor_type if editor_type is not None else base_revision["editor_type"],
        "attachments": deepcopy(attachments if attachments is not None else base_revision.get("attachments", [])),
        "module_data": deepcopy(module_data if module_data is not None else base_revision.get("module_data", {})),
        "change_log": change_log,
        "created_by": actor_id,
        "created_at": now,
    }
    next_root = deepcopy(root)
    next_root["metadata"]["version"] = next_version
    next_root["metadata"]["updated_at"] = now
    next_root["updated_by"] = actor_id
    next_root["working_revision_id"] = next_revision["id"]
    if next_root["published_revision_id"] is None:
        next_root["header"] = deepcopy(next_revision["header"])
        next_root["module_data"] = deepcopy(next_revision["module_data"])
        next_root["state"]["status"] = DocumentStatus.draft.value
    return next_root, next_revision


def _share_to_acl_rule(share: dict[str, Any]) -> dict[str, Any]:
    actions = [DocumentAclAction.read.value]
    if share.get("permission") == "edit":
        actions = [DocumentAclAction.edit.value]
    return {
        "subject_type": share["target_type"],
        "subject_id": share["target_id"],
        "actions": actions,
        "effect": DocumentAclEffect.allow.value,
    }


def _migrate_legacy_documents(
    legacy_documents: list[dict[str, Any]],
    legacy_shares: list[dict[str, Any]],
    legacy_attachments: list[dict[str, Any]],
    legacy_policies: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    attachments_by_doc: dict[str, list[dict[str, Any]]] = {}
    for attachment in legacy_attachments:
        attachments_by_doc.setdefault(attachment["doc_id"], []).append(deepcopy(attachment))

    shares_by_doc: dict[str, list[dict[str, Any]]] = {}
    for share in legacy_shares:
        shares_by_doc.setdefault(share["doc_id"], []).append(deepcopy(share))

    policies: list[dict[str, Any]] = []
    for rule in legacy_policies:
        policies.append(
            {
                "id": new_id("policy"),
                "target_type": "Board",
                "target_id": rule["board_id"],
                "subject_type": rule["subject_type"],
                "subject_id": rule["subject_id"],
                "actions": list(rule["actions"]),
                "created_at": rule["created_at"],
                "updated_at": rule["updated_at"],
            }
        )

    groups: dict[str, list[dict[str, Any]]] = {}
    for document in legacy_documents:
        if "header" in document:
            continue
        groups.setdefault(document["origin_doc_id"], []).append(deepcopy(document))

    roots: list[dict[str, Any]] = []
    revisions: list[dict[str, Any]] = []
    for origin_doc_id, chain in groups.items():
        chain.sort(key=lambda row: row["version_number"])
        published_row = next((row for row in reversed(chain) if row["status"] == "published"), None)
        working_row = next((row for row in reversed(chain) if row["status"] == "draft"), None)
        public_row = published_row or working_row or chain[-1]
        access_row = working_row or public_row
        revision_ids: dict[str, str] = {}
        for row in chain:
            revision_id = f"rev_{row['id']}"
            revision_ids[row["id"]] = revision_id
            header = {
                "title": row["title"],
                "category": "BoardDocument",
                "tags": [],
                "author_id": row["created_by"],
            }
            revision_attachments = [
                {
                    "id": attachment["id"],
                    "file_name": attachment["file_name"],
                    "mime_type": attachment["mime_type"],
                    "size_bytes": attachment["size_bytes"],
                    "storage_key": attachment["storage_key"],
                    "version": row["version_number"],
                    "created_by": attachment["created_by"],
                    "created_at": attachment["created_at"],
                    "updated_at": attachment["updated_at"],
                }
                for attachment in attachments_by_doc.get(row["id"], [])
            ]
            module_data = {}
            if row.get("approval_template_id"):
                module_data = {"approval": {"templateId": row["approval_template_id"]}}
            revisions.append(
                {
                    "id": revision_id,
                    "document_id": origin_doc_id,
                    "version": row["version_number"],
                    "header": header,
                    "body": row.get("content", ""),
                    "summary": _plain_text_summary(row.get("content", "")),
                    "editor_type": DocumentEditorType.tiptap.value,
                    "attachments": revision_attachments,
                    "module_data": module_data,
                    "change_log": "",
                    "created_by": row["updated_by"],
                    "created_at": row["updated_at"],
                }
            )
        security_acl = [_share_to_acl_rule(share) for share in shares_by_doc.get(access_row["id"], [])]
        root_module_data = {}
        if public_row.get("approval_template_id"):
            root_module_data = {"approval": {"templateId": public_row["approval_template_id"]}}
        roots.append(
            {
                "id": origin_doc_id,
                "header": {
                    "title": public_row["title"],
                    "category": "BoardDocument",
                    "tags": [],
                    "author_id": chain[0]["created_by"],
                },
                "link": {
                    "target_type": "Board",
                    "target_id": public_row["board_id"],
                    "deep_link": f"/udms/boards?targetId={public_row['board_id']}",
                },
                "state": {
                    "status": DocumentStatus.published.value
                    if published_row is not None
                    else DocumentStatus.draft.value
                },
                "security": {"acl": security_acl, "external_shares": []},
                "module_data": root_module_data,
                "metadata": {
                    "version": chain[-1]["version_number"],
                    "is_deleted": False,
                    "archived_at": None,
                    "created_at": chain[0]["created_at"],
                    "updated_at": chain[-1]["updated_at"],
                },
                "published_revision_id": revision_ids[published_row["id"]] if published_row else None,
                "working_revision_id": revision_ids[working_row["id"]] if working_row else None,
                "created_by": chain[0]["created_by"],
                "updated_by": chain[-1]["updated_by"],
            }
        )
    return roots, revisions, policies


class UdmsRepository(Protocol):
    async def ensure_indexes(self) -> None: ...

    async def seed_defaults_if_empty(self) -> None: ...

    async def list_boards(self) -> list[dict[str, Any]]: ...

    async def get_board(self, board_id: str) -> dict[str, Any]: ...

    async def create_board(self, payload: dict[str, Any]) -> dict[str, Any]: ...

    async def update_board(self, board_id: str, payload: dict[str, Any]) -> dict[str, Any]: ...

    async def list_approval_templates(self) -> list[dict[str, Any]]: ...

    async def list_target_policies(self, target_type: str | None = None, target_id: str | None = None) -> list[dict[str, Any]]: ...

    async def replace_target_policies(self, target_type: str, target_id: str, rules: list[dict[str, Any]]) -> list[dict[str, Any]]: ...

    async def list_documents(self, target_type: str | None = None, target_id: str | None = None, status: str | None = None) -> list[dict[str, Any]]: ...

    async def get_document(self, document_id: str) -> dict[str, Any]: ...

    async def get_revision(self, revision_id: str) -> dict[str, Any]: ...

    async def get_revision_by_version(self, document_id: str, version: int) -> dict[str, Any]: ...

    async def list_revisions(self, document_id: str) -> list[dict[str, Any]]: ...

    async def create_document(self, payload: dict[str, Any]) -> dict[str, Any]: ...

    async def update_working_copy(self, document_id: str, payload: dict[str, Any]) -> dict[str, Any]: ...

    async def create_working_copy(self, document_id: str, actor_id: str) -> dict[str, Any]: ...

    async def publish_document(self, document_id: str, actor_id: str) -> dict[str, Any]: ...

    async def rollback_document(self, document_id: str, target_version: int, actor_id: str) -> dict[str, Any]: ...

    async def replace_document_security(self, document_id: str, payload: dict[str, Any], actor_id: str) -> dict[str, Any]: ...

    async def create_external_share(self, document_id: str, payload: dict[str, Any], actor_id: str) -> dict[str, Any]: ...

    async def delete_external_share(self, document_id: str, share_id: str, actor_id: str) -> dict[str, Any]: ...

    async def replace_working_attachments(self, document_id: str, attachments: list[dict[str, Any]], change_log: str, actor_id: str) -> dict[str, Any]: ...

    async def find_attachment(self, attachment_id: str) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]: ...

    async def count_storage_refs(self, storage_key: str) -> int: ...

    async def lock_document(self, document_id: str, actor_id: str) -> dict[str, Any]: ...

    async def lock_documents_for_target(self, target_type: str, target_id: str, actor_id: str) -> list[dict[str, Any]]: ...

    async def handle_parent_deleted(self, target_type: str, target_id: str, policy: str, actor_id: str) -> list[dict[str, Any]]: ...

    async def append_audit_entry(self, *, action: str, target_type: str, target_id: str, actor_id: str, detail: str) -> None: ...


class MongoUdmsRepository:
    def __init__(self, database: AsyncIOMotorDatabase):
        self.boards = database["udms_boards"]
        self.documents = database["udms_documents"]
        self.revisions = database["udms_document_revisions"]
        self.target_policies = database["udms_target_policies"]
        self.approval_templates = database["udms_approval_templates"]
        self.audit_logs = database["udms_audit_logs"]
        self.legacy_shares = database["udms_shares"]
        self.legacy_board_permissions = database["udms_board_permissions"]
        self.legacy_attachments = database["udms_attachments"]

    async def ensure_indexes(self) -> None:
        index_info = await self.documents.index_information()
        for name, info in index_info.items():
            if name == "_id_":
                continue
            keys = [field for field, _direction in info.get("key", [])]
            if {"origin_doc_id", "version_number"} & set(keys):
                await self.documents.drop_index(name)
        await self.boards.create_index([("id", ASCENDING)], unique=True)
        await self.documents.create_index([("id", ASCENDING)], unique=True)
        await self.documents.create_index([("link.target_type", ASCENDING), ("link.target_id", ASCENDING)])
        await self.documents.create_index([("state.status", ASCENDING)])
        await self.documents.create_index([("metadata.updated_at", ASCENDING)])
        await self.revisions.create_index([("id", ASCENDING)], unique=True)
        await self.revisions.create_index([("document_id", ASCENDING), ("version", ASCENDING)], unique=True)
        await self.target_policies.create_index([("id", ASCENDING)], unique=True)
        await self.target_policies.create_index([("target_type", ASCENDING), ("target_id", ASCENDING)])
        await self.approval_templates.create_index([("id", ASCENDING)], unique=True)
        await self.audit_logs.create_index([("id", ASCENDING)], unique=True)
        await self.audit_logs.create_index([("target_type", ASCENDING), ("target_id", ASCENDING), ("created_at", ASCENDING)])

    async def seed_defaults_if_empty(self) -> None:
        await self._migrate_legacy_if_needed()
        if await self.boards.count_documents({}) == 0:
            now = iso_now()
            await self.boards.insert_one(_seed_board(now))
        if await self.documents.count_documents({}) == 0:
            now = iso_now()
            root, revision = _seed_document_bundle(now)
            await self.documents.insert_one(root)
            await self.revisions.insert_one(revision)
        if await self.target_policies.count_documents({}) == 0:
            await self.target_policies.insert_many(_seed_target_policies(iso_now()))
        if await self.approval_templates.count_documents({}) == 0:
            await self.approval_templates.insert_many(_seed_approval_templates(iso_now()))

    async def _migrate_legacy_if_needed(self) -> None:
        legacy_documents = await self.documents.find({"origin_doc_id": {"$exists": True}}, {"_id": False}).to_list(None)
        if not legacy_documents:
            return
        legacy_shares = await self.legacy_shares.find({}, {"_id": False}).to_list(None)
        legacy_attachments = await self.legacy_attachments.find({}, {"_id": False}).to_list(None)
        legacy_policies = await self.legacy_board_permissions.find({}, {"_id": False}).to_list(None)
        roots, revisions, policies = _migrate_legacy_documents(
            legacy_documents,
            legacy_shares,
            legacy_attachments,
            legacy_policies,
        )
        await self.documents.delete_many({})
        if roots:
            await self.documents.insert_many(roots)
        await self.revisions.delete_many({})
        if revisions:
            await self.revisions.insert_many(revisions)
        await self.target_policies.delete_many({})
        if policies:
            await self.target_policies.insert_many(policies)
        await self.legacy_shares.drop()
        await self.legacy_board_permissions.drop()
        await self.legacy_attachments.drop()

    async def list_boards(self) -> list[dict[str, Any]]:
        return await self.boards.find({}, {"_id": False}).sort("name", ASCENDING).to_list(None)

    async def get_board(self, board_id: str) -> dict[str, Any]:
        board = await self.boards.find_one({"id": board_id}, {"_id": False})
        if board is None:
            raise NotFoundError(f"Board '{board_id}' was not found.")
        return board

    async def create_board(self, payload: dict[str, Any]) -> dict[str, Any]:
        now = iso_now()
        board = {
            "id": payload.get("id") or new_id("board"),
            "name": payload["name"],
            "description": payload.get("description", ""),
            "is_active": payload.get("is_active", True),
            "created_at": now,
            "updated_at": now,
        }
        await self.boards.insert_one(deepcopy(board))
        return board

    async def update_board(self, board_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        board = await self.get_board(board_id)
        board.update(
            {
                "name": payload["name"],
                "description": payload.get("description", ""),
                "is_active": payload.get("is_active", True),
                "updated_at": iso_now(),
            }
        )
        await self.boards.replace_one({"id": board_id}, board)
        return board

    async def list_approval_templates(self) -> list[dict[str, Any]]:
        return await self.approval_templates.find({"is_active": True}, {"_id": False}).sort("name", ASCENDING).to_list(None)

    async def list_target_policies(self, target_type: str | None = None, target_id: str | None = None) -> list[dict[str, Any]]:
        query: dict[str, Any] = {}
        if target_type:
            query["target_type"] = target_type
        if target_id:
            query["target_id"] = target_id
        return await self.target_policies.find(query, {"_id": False}).sort(
            [("target_type", ASCENDING), ("target_id", ASCENDING), ("subject_type", ASCENDING), ("subject_id", ASCENDING)]
        ).to_list(None)

    async def replace_target_policies(self, target_type: str, target_id: str, rules: list[dict[str, Any]]) -> list[dict[str, Any]]:
        await self.target_policies.delete_many({"target_type": target_type, "target_id": target_id})
        now = iso_now()
        rows = [
            {
                "id": new_id("policy"),
                "target_type": target_type,
                "target_id": target_id,
                "subject_type": item["subject_type"],
                "subject_id": item["subject_id"],
                "actions": item["actions"],
                "created_at": now,
                "updated_at": now,
            }
            for item in rules
        ]
        if rows:
            await self.target_policies.insert_many(deepcopy(rows))
        return rows

    async def list_documents(self, target_type: str | None = None, target_id: str | None = None, status: str | None = None) -> list[dict[str, Any]]:
        query: dict[str, Any] = {"metadata.is_deleted": False}
        if target_type:
            query["link.target_type"] = target_type
        if target_id:
            query["link.target_id"] = target_id
        if status:
            query["state.status"] = status
        return await self.documents.find(query, {"_id": False}).sort("metadata.updated_at", -1).to_list(None)

    async def get_document(self, document_id: str) -> dict[str, Any]:
        document = await self.documents.find_one({"id": document_id, "metadata.is_deleted": False}, {"_id": False})
        if document is None:
            raise NotFoundError(f"Document '{document_id}' was not found.")
        return document

    async def get_revision(self, revision_id: str) -> dict[str, Any]:
        revision = await self.revisions.find_one({"id": revision_id}, {"_id": False})
        if revision is None:
            raise NotFoundError(f"Revision '{revision_id}' was not found.")
        return revision

    async def get_revision_by_version(self, document_id: str, version: int) -> dict[str, Any]:
        revision = await self.revisions.find_one({"document_id": document_id, "version": version}, {"_id": False})
        if revision is None:
            raise NotFoundError(f"Document '{document_id}' version '{version}' was not found.")
        return revision

    async def list_revisions(self, document_id: str) -> list[dict[str, Any]]:
        return await self.revisions.find({"document_id": document_id}, {"_id": False}).sort("version", -1).to_list(None)

    async def create_document(self, payload: dict[str, Any]) -> dict[str, Any]:
        root, revision = _create_document_bundle(payload)
        await self.documents.insert_one(deepcopy(root))
        await self.revisions.insert_one(deepcopy(revision))
        return root

    async def update_working_copy(self, document_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        root = await self.get_document(document_id)
        if root["working_revision_id"] is None:
            raise ConflictError("No working draft exists for this document.")
        base_revision = await self.get_revision(root["working_revision_id"])
        next_header = deepcopy(base_revision["header"])
        if payload.get("title") is not None:
            next_header["title"] = payload["title"]
        if payload.get("category") is not None:
            next_header["category"] = payload["category"]
        if payload.get("tags") is not None:
            next_header["tags"] = payload["tags"]
        next_module_data = deepcopy(base_revision.get("module_data", {}))
        if payload.get("module_data") is not None:
            next_module_data = deepcopy(payload["module_data"])
        if payload.get("target_type") or payload.get("target_id"):
            if root["published_revision_id"] is not None:
                raise ConflictError("Target binding cannot change after the first publish.")
            root["link"] = {
                "target_type": payload.get("target_type", root["link"]["target_type"]),
                "target_id": payload.get("target_id", root["link"]["target_id"]),
                "deep_link": payload["deep_link"],
            }
        next_root, next_revision = _clone_revision(
            root,
            base_revision,
            actor_id=payload["actor_id"],
            header=next_header,
            body=payload.get("body"),
            module_data=next_module_data,
            editor_type=payload.get("editor_type"),
            change_log=payload.get("change_log", ""),
        )
        await self.documents.replace_one({"id": document_id}, next_root)
        await self.revisions.insert_one(next_revision)
        return next_root

    async def create_working_copy(self, document_id: str, actor_id: str) -> dict[str, Any]:
        root = await self.get_document(document_id)
        if root["working_revision_id"] is not None:
            return root
        if root["published_revision_id"] is None:
            raise ConflictError("Draft documents already have a working copy.")
        base_revision = await self.get_revision(root["published_revision_id"])
        next_root, next_revision = _clone_revision(root, base_revision, actor_id=actor_id, change_log="Create working copy")
        next_root["state"]["status"] = root["state"]["status"]
        await self.documents.replace_one({"id": document_id}, next_root)
        await self.revisions.insert_one(next_revision)
        return next_root

    async def publish_document(self, document_id: str, actor_id: str) -> dict[str, Any]:
        root = await self.get_document(document_id)
        if root["working_revision_id"] is None:
            raise ConflictError("No working draft exists to publish.")
        revision = await self.get_revision(root["working_revision_id"])
        now = iso_now()
        root["published_revision_id"] = revision["id"]
        root["working_revision_id"] = None
        root["header"] = deepcopy(revision["header"])
        root["module_data"] = deepcopy(revision.get("module_data", {}))
        root["state"]["status"] = DocumentStatus.published.value
        root["metadata"]["updated_at"] = now
        root["updated_by"] = actor_id
        await self.documents.replace_one({"id": document_id}, root)
        return root

    async def rollback_document(self, document_id: str, target_version: int, actor_id: str) -> dict[str, Any]:
        root = await self.get_document(document_id)
        target_revision = await self.get_revision_by_version(document_id, target_version)
        next_root, next_revision = _clone_revision(
            root,
            target_revision,
            actor_id=actor_id,
            change_log=f"Rollback to version {target_version}",
        )
        await self.documents.replace_one({"id": document_id}, next_root)
        await self.revisions.insert_one(next_revision)
        return next_root

    async def replace_document_security(self, document_id: str, payload: dict[str, Any], actor_id: str) -> dict[str, Any]:
        root = await self.get_document(document_id)
        root["security"]["acl"] = deepcopy(payload.get("acl", []))
        root["metadata"]["updated_at"] = iso_now()
        root["updated_by"] = actor_id
        await self.documents.replace_one({"id": document_id}, root)
        return root

    async def create_external_share(self, document_id: str, payload: dict[str, Any], actor_id: str) -> dict[str, Any]:
        root = await self.get_document(document_id)
        root["security"].setdefault("external_shares", [])
        root["security"]["external_shares"].append(
            {
                "id": new_id("share"),
                "label": payload["label"],
                "token": new_id("token"),
                "expires_at": payload.get("expires_at"),
                "can_download": payload.get("can_download", True),
                "created_by": actor_id,
                "created_at": iso_now(),
            }
        )
        root["metadata"]["updated_at"] = iso_now()
        root["updated_by"] = actor_id
        await self.documents.replace_one({"id": document_id}, root)
        return root

    async def delete_external_share(self, document_id: str, share_id: str, actor_id: str) -> dict[str, Any]:
        root = await self.get_document(document_id)
        existing = root["security"].get("external_shares", [])
        next_links = [item for item in existing if item["id"] != share_id]
        if len(next_links) == len(existing):
            raise NotFoundError(f"External share '{share_id}' was not found.")
        root["security"]["external_shares"] = next_links
        root["metadata"]["updated_at"] = iso_now()
        root["updated_by"] = actor_id
        await self.documents.replace_one({"id": document_id}, root)
        return root

    async def replace_working_attachments(
        self,
        document_id: str,
        attachments: list[dict[str, Any]],
        change_log: str,
        actor_id: str,
    ) -> dict[str, Any]:
        root = await self.get_document(document_id)
        if root["working_revision_id"] is None:
            raise ConflictError("No working draft exists for this document.")
        base_revision = await self.get_revision(root["working_revision_id"])
        next_root, next_revision = _clone_revision(
            root,
            base_revision,
            actor_id=actor_id,
            attachments=attachments,
            change_log=change_log,
        )
        await self.documents.replace_one({"id": document_id}, next_root)
        await self.revisions.insert_one(next_revision)
        return next_root

    async def find_attachment(self, attachment_id: str) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
        revision = await self.revisions.find_one({"attachments.id": attachment_id}, {"_id": False})
        if revision is None:
            raise NotFoundError(f"Attachment '{attachment_id}' was not found.")
        attachment = next(item for item in revision["attachments"] if item["id"] == attachment_id)
        root = await self.get_document(revision["document_id"])
        return root, revision, attachment

    async def count_storage_refs(self, storage_key: str) -> int:
        revisions = await self.revisions.find({"attachments.storage_key": storage_key}, {"_id": False, "attachments": True}).to_list(None)
        count = 0
        for revision in revisions:
            count += len([item for item in revision.get("attachments", []) if item["storage_key"] == storage_key])
        return count

    async def lock_document(self, document_id: str, actor_id: str) -> dict[str, Any]:
        root = await self.get_document(document_id)
        if root["published_revision_id"] is None and root["working_revision_id"] is not None:
            working_revision = await self.get_revision(root["working_revision_id"])
            root["published_revision_id"] = working_revision["id"]
            root["header"] = deepcopy(working_revision["header"])
            root["module_data"] = deepcopy(working_revision.get("module_data", {}))
        root["working_revision_id"] = None
        root["state"]["status"] = DocumentStatus.locked.value
        root["metadata"]["updated_at"] = iso_now()
        root["updated_by"] = actor_id
        await self.documents.replace_one({"id": document_id}, root)
        return root

    async def lock_documents_for_target(self, target_type: str, target_id: str, actor_id: str) -> list[dict[str, Any]]:
        documents = await self.list_documents(target_type=target_type, target_id=target_id)
        locked: list[dict[str, Any]] = []
        for document in documents:
            locked.append(await self.lock_document(document["id"], actor_id))
        return locked

    async def handle_parent_deleted(self, target_type: str, target_id: str, policy: str, actor_id: str) -> list[dict[str, Any]]:
        documents = await self.list_documents(target_type=target_type, target_id=target_id)
        updated: list[dict[str, Any]] = []
        for document in documents:
            now = iso_now()
            if policy == "cascade":
                document["state"]["status"] = DocumentStatus.archived.value
                document["metadata"]["is_deleted"] = True
                document["metadata"]["archived_at"] = now
                document["working_revision_id"] = None
            else:
                document["link"]["target_id"] = f"orphan:{target_id}"
                document["link"]["deep_link"] = "/udms/documents"
            document["metadata"]["updated_at"] = now
            document["updated_by"] = actor_id
            await self.documents.replace_one({"id": document["id"]}, document)
            updated.append(document)
        return updated

    async def append_audit_entry(self, *, action: str, target_type: str, target_id: str, actor_id: str, detail: str) -> None:
        await self.audit_logs.insert_one(
            {
                "id": new_id("audit"),
                "action": action,
                "target_type": target_type,
                "target_id": target_id,
                "actor_id": actor_id,
                "detail": detail,
                "created_at": iso_now(),
            }
        )


class InMemoryUdmsRepository:
    def __init__(self) -> None:
        self.boards: dict[str, dict[str, Any]] = {}
        self.documents: dict[str, dict[str, Any]] = {}
        self.revisions: dict[str, dict[str, Any]] = {}
        self.target_policies: dict[str, dict[str, Any]] = {}
        self.approval_templates: dict[str, dict[str, Any]] = {}
        self.audit_logs: list[dict[str, Any]] = []

    @classmethod
    def bootstrap(cls) -> "InMemoryUdmsRepository":
        repo = cls()
        now = iso_now()
        board = _seed_board(now)
        root, revision = _seed_document_bundle(now)
        repo.boards[board["id"]] = board
        repo.documents[root["id"]] = root
        repo.revisions[revision["id"]] = revision
        for rule in _seed_target_policies(now):
            repo.target_policies[rule["id"]] = rule
        for template in _seed_approval_templates(now):
            repo.approval_templates[template["id"]] = template
        return repo

    @classmethod
    def bootstrap_legacy(cls) -> "InMemoryUdmsRepository":
        repo = cls()
        now = iso_now()
        board = _seed_board(now)
        repo.boards[board["id"]] = board
        legacy_documents = [
            {
                "id": "doc-legacy-v1",
                "origin_doc_id": "doc-legacy",
                "prev_doc_id": None,
                "version_number": 1,
                "board_id": board["id"],
                "title": "레거시 문서",
                "content": "<p>첫 번째 게시본</p>",
                "status": "published",
                "approval_template_id": "approval-general",
                "created_by": "system",
                "updated_by": "system",
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": "doc-legacy-v2",
                "origin_doc_id": "doc-legacy",
                "prev_doc_id": "doc-legacy-v1",
                "version_number": 2,
                "board_id": board["id"],
                "title": "레거시 문서 수정안",
                "content": "<p>두 번째 초안</p>",
                "status": "draft",
                "approval_template_id": "approval-general",
                "created_by": "system",
                "updated_by": "system",
                "created_at": now,
                "updated_at": now,
            },
        ]
        legacy_shares = [
            {
                "id": "share-legacy",
                "doc_id": "doc-legacy-v2",
                "target_type": "department",
                "target_id": "새가족부",
                "permission": "edit",
                "created_by": "system",
                "created_at": now,
                "updated_at": now,
            }
        ]
        legacy_attachments = [
            {
                "id": "file-legacy",
                "doc_id": "doc-legacy-v2",
                "storage_key": "legacy/doc-legacy/file-legacy.txt",
                "file_name": "legacy.txt",
                "mime_type": "text/plain",
                "size_bytes": 8,
                "created_by": "system",
                "created_at": now,
                "updated_at": now,
            }
        ]
        legacy_policies = [
            {
                "id": "perm-legacy",
                "board_id": board["id"],
                "subject_type": PermissionSubjectType.role.value,
                "subject_id": "editor",
                "actions": [TargetPolicyAction.read.value, TargetPolicyAction.create.value],
                "created_at": now,
                "updated_at": now,
            }
        ]
        roots, revisions, policies = _migrate_legacy_documents(legacy_documents, legacy_shares, legacy_attachments, legacy_policies)
        for root in roots:
            repo.documents[root["id"]] = root
        for revision in revisions:
            repo.revisions[revision["id"]] = revision
        for policy in policies:
            repo.target_policies[policy["id"]] = policy
        for template in _seed_approval_templates(now):
            repo.approval_templates[template["id"]] = template
        return repo

    async def ensure_indexes(self) -> None:
        return None

    async def seed_defaults_if_empty(self) -> None:
        if self.boards:
            return
        seeded = self.bootstrap()
        self.boards = seeded.boards
        self.documents = seeded.documents
        self.revisions = seeded.revisions
        self.target_policies = seeded.target_policies
        self.approval_templates = seeded.approval_templates

    async def list_boards(self) -> list[dict[str, Any]]:
        return [deepcopy(item) for item in sorted(self.boards.values(), key=lambda row: row["name"])]

    async def get_board(self, board_id: str) -> dict[str, Any]:
        board = self.boards.get(board_id)
        if board is None:
            raise NotFoundError(f"Board '{board_id}' was not found.")
        return deepcopy(board)

    async def create_board(self, payload: dict[str, Any]) -> dict[str, Any]:
        now = iso_now()
        board = {
            "id": payload.get("id") or new_id("board"),
            "name": payload["name"],
            "description": payload.get("description", ""),
            "is_active": payload.get("is_active", True),
            "created_at": now,
            "updated_at": now,
        }
        self.boards[board["id"]] = board
        return deepcopy(board)

    async def update_board(self, board_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        board = self.boards.get(board_id)
        if board is None:
            raise NotFoundError(f"Board '{board_id}' was not found.")
        board.update(
            {
                "name": payload["name"],
                "description": payload.get("description", ""),
                "is_active": payload.get("is_active", True),
                "updated_at": iso_now(),
            }
        )
        return deepcopy(board)

    async def list_approval_templates(self) -> list[dict[str, Any]]:
        return [
            deepcopy(item)
            for item in sorted(self.approval_templates.values(), key=lambda row: row["name"])
            if item["is_active"]
        ]

    async def list_target_policies(self, target_type: str | None = None, target_id: str | None = None) -> list[dict[str, Any]]:
        rows = list(self.target_policies.values())
        if target_type:
            rows = [row for row in rows if row["target_type"] == target_type]
        if target_id:
            rows = [row for row in rows if row["target_id"] == target_id]
        rows.sort(key=lambda row: (row["target_type"], row["target_id"], row["subject_type"], row["subject_id"]))
        return [deepcopy(row) for row in rows]

    async def replace_target_policies(self, target_type: str, target_id: str, rules: list[dict[str, Any]]) -> list[dict[str, Any]]:
        for key, value in list(self.target_policies.items()):
            if value["target_type"] == target_type and value["target_id"] == target_id:
                self.target_policies.pop(key)
        now = iso_now()
        created: list[dict[str, Any]] = []
        for rule in rules:
            item = {
                "id": new_id("policy"),
                "target_type": target_type,
                "target_id": target_id,
                "subject_type": rule["subject_type"],
                "subject_id": rule["subject_id"],
                "actions": list(rule["actions"]),
                "created_at": now,
                "updated_at": now,
            }
            self.target_policies[item["id"]] = item
            created.append(deepcopy(item))
        return created

    async def list_documents(self, target_type: str | None = None, target_id: str | None = None, status: str | None = None) -> list[dict[str, Any]]:
        rows = [row for row in self.documents.values() if not row["metadata"].get("is_deleted", False)]
        if target_type:
            rows = [row for row in rows if row["link"]["target_type"] == target_type]
        if target_id:
            rows = [row for row in rows if row["link"]["target_id"] == target_id]
        if status:
            rows = [row for row in rows if row["state"]["status"] == status]
        rows.sort(key=lambda row: row["metadata"]["updated_at"], reverse=True)
        return [deepcopy(row) for row in rows]

    async def get_document(self, document_id: str) -> dict[str, Any]:
        document = self.documents.get(document_id)
        if document is None or document["metadata"].get("is_deleted", False):
            raise NotFoundError(f"Document '{document_id}' was not found.")
        return deepcopy(document)

    async def get_revision(self, revision_id: str) -> dict[str, Any]:
        revision = self.revisions.get(revision_id)
        if revision is None:
            raise NotFoundError(f"Revision '{revision_id}' was not found.")
        return deepcopy(revision)

    async def get_revision_by_version(self, document_id: str, version: int) -> dict[str, Any]:
        for revision in self.revisions.values():
            if revision["document_id"] == document_id and revision["version"] == version:
                return deepcopy(revision)
        raise NotFoundError(f"Document '{document_id}' version '{version}' was not found.")

    async def list_revisions(self, document_id: str) -> list[dict[str, Any]]:
        rows = [deepcopy(row) for row in self.revisions.values() if row["document_id"] == document_id]
        rows.sort(key=lambda row: row["version"], reverse=True)
        return rows

    async def create_document(self, payload: dict[str, Any]) -> dict[str, Any]:
        root, revision = _create_document_bundle(payload)
        self.documents[root["id"]] = root
        self.revisions[revision["id"]] = revision
        return deepcopy(root)

    async def update_working_copy(self, document_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        root = self.documents.get(document_id)
        if root is None:
            raise NotFoundError(f"Document '{document_id}' was not found.")
        if root["working_revision_id"] is None:
            raise ConflictError("No working draft exists for this document.")
        base_revision = self.revisions[root["working_revision_id"]]
        next_header = deepcopy(base_revision["header"])
        if payload.get("title") is not None:
            next_header["title"] = payload["title"]
        if payload.get("category") is not None:
            next_header["category"] = payload["category"]
        if payload.get("tags") is not None:
            next_header["tags"] = payload["tags"]
        next_module_data = deepcopy(base_revision.get("module_data", {}))
        if payload.get("module_data") is not None:
            next_module_data = deepcopy(payload["module_data"])
        if payload.get("target_type") or payload.get("target_id"):
            if root["published_revision_id"] is not None:
                raise ConflictError("Target binding cannot change after the first publish.")
            root["link"] = {
                "target_type": payload.get("target_type", root["link"]["target_type"]),
                "target_id": payload.get("target_id", root["link"]["target_id"]),
                "deep_link": payload["deep_link"],
            }
        next_root, next_revision = _clone_revision(
            root,
            base_revision,
            actor_id=payload["actor_id"],
            header=next_header,
            body=payload.get("body"),
            module_data=next_module_data,
            editor_type=payload.get("editor_type"),
            change_log=payload.get("change_log", ""),
        )
        self.documents[document_id] = next_root
        self.revisions[next_revision["id"]] = next_revision
        return deepcopy(next_root)

    async def create_working_copy(self, document_id: str, actor_id: str) -> dict[str, Any]:
        root = self.documents.get(document_id)
        if root is None:
            raise NotFoundError(f"Document '{document_id}' was not found.")
        if root["working_revision_id"] is not None:
            return deepcopy(root)
        if root["published_revision_id"] is None:
            raise ConflictError("Draft documents already have a working copy.")
        base_revision = self.revisions[root["published_revision_id"]]
        next_root, next_revision = _clone_revision(root, base_revision, actor_id=actor_id, change_log="Create working copy")
        next_root["state"]["status"] = root["state"]["status"]
        self.documents[document_id] = next_root
        self.revisions[next_revision["id"]] = next_revision
        return deepcopy(next_root)

    async def publish_document(self, document_id: str, actor_id: str) -> dict[str, Any]:
        root = self.documents.get(document_id)
        if root is None:
            raise NotFoundError(f"Document '{document_id}' was not found.")
        if root["working_revision_id"] is None:
            raise ConflictError("No working draft exists to publish.")
        revision = self.revisions[root["working_revision_id"]]
        root["published_revision_id"] = revision["id"]
        root["working_revision_id"] = None
        root["header"] = deepcopy(revision["header"])
        root["module_data"] = deepcopy(revision.get("module_data", {}))
        root["state"]["status"] = DocumentStatus.published.value
        root["metadata"]["updated_at"] = iso_now()
        root["updated_by"] = actor_id
        return deepcopy(root)

    async def rollback_document(self, document_id: str, target_version: int, actor_id: str) -> dict[str, Any]:
        root = self.documents.get(document_id)
        if root is None:
            raise NotFoundError(f"Document '{document_id}' was not found.")
        target_revision = None
        for revision in self.revisions.values():
            if revision["document_id"] == document_id and revision["version"] == target_version:
                target_revision = revision
                break
        if target_revision is None:
            raise NotFoundError(f"Document '{document_id}' version '{target_version}' was not found.")
        next_root, next_revision = _clone_revision(root, target_revision, actor_id=actor_id, change_log=f"Rollback to version {target_version}")
        self.documents[document_id] = next_root
        self.revisions[next_revision["id"]] = next_revision
        return deepcopy(next_root)

    async def replace_document_security(self, document_id: str, payload: dict[str, Any], actor_id: str) -> dict[str, Any]:
        root = self.documents.get(document_id)
        if root is None:
            raise NotFoundError(f"Document '{document_id}' was not found.")
        root["security"]["acl"] = deepcopy(payload.get("acl", []))
        root["metadata"]["updated_at"] = iso_now()
        root["updated_by"] = actor_id
        return deepcopy(root)

    async def create_external_share(self, document_id: str, payload: dict[str, Any], actor_id: str) -> dict[str, Any]:
        root = self.documents.get(document_id)
        if root is None:
            raise NotFoundError(f"Document '{document_id}' was not found.")
        root["security"].setdefault("external_shares", [])
        root["security"]["external_shares"].append(
            {
                "id": new_id("share"),
                "label": payload["label"],
                "token": new_id("token"),
                "expires_at": payload.get("expires_at"),
                "can_download": payload.get("can_download", True),
                "created_by": actor_id,
                "created_at": iso_now(),
            }
        )
        root["metadata"]["updated_at"] = iso_now()
        root["updated_by"] = actor_id
        return deepcopy(root)

    async def delete_external_share(self, document_id: str, share_id: str, actor_id: str) -> dict[str, Any]:
        root = self.documents.get(document_id)
        if root is None:
            raise NotFoundError(f"Document '{document_id}' was not found.")
        existing = root["security"].get("external_shares", [])
        next_links = [item for item in existing if item["id"] != share_id]
        if len(next_links) == len(existing):
            raise NotFoundError(f"External share '{share_id}' was not found.")
        root["security"]["external_shares"] = next_links
        root["metadata"]["updated_at"] = iso_now()
        root["updated_by"] = actor_id
        return deepcopy(root)

    async def replace_working_attachments(self, document_id: str, attachments: list[dict[str, Any]], change_log: str, actor_id: str) -> dict[str, Any]:
        root = self.documents.get(document_id)
        if root is None:
            raise NotFoundError(f"Document '{document_id}' was not found.")
        if root["working_revision_id"] is None:
            raise ConflictError("No working draft exists for this document.")
        base_revision = self.revisions[root["working_revision_id"]]
        next_root, next_revision = _clone_revision(root, base_revision, actor_id=actor_id, attachments=attachments, change_log=change_log)
        self.documents[document_id] = next_root
        self.revisions[next_revision["id"]] = next_revision
        return deepcopy(next_root)

    async def find_attachment(self, attachment_id: str) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
        for revision in self.revisions.values():
            for attachment in revision.get("attachments", []):
                if attachment["id"] == attachment_id:
                    document = self.documents.get(revision["document_id"])
                    if document is None:
                        break
                    return deepcopy(document), deepcopy(revision), deepcopy(attachment)
        raise NotFoundError(f"Attachment '{attachment_id}' was not found.")

    async def count_storage_refs(self, storage_key: str) -> int:
        count = 0
        for revision in self.revisions.values():
            count += len([item for item in revision.get("attachments", []) if item["storage_key"] == storage_key])
        return count

    async def lock_document(self, document_id: str, actor_id: str) -> dict[str, Any]:
        root = self.documents.get(document_id)
        if root is None:
            raise NotFoundError(f"Document '{document_id}' was not found.")
        if root["published_revision_id"] is None and root["working_revision_id"] is not None:
            working_revision = self.revisions[root["working_revision_id"]]
            root["published_revision_id"] = working_revision["id"]
            root["header"] = deepcopy(working_revision["header"])
            root["module_data"] = deepcopy(working_revision.get("module_data", {}))
        root["working_revision_id"] = None
        root["state"]["status"] = DocumentStatus.locked.value
        root["metadata"]["updated_at"] = iso_now()
        root["updated_by"] = actor_id
        return deepcopy(root)

    async def lock_documents_for_target(self, target_type: str, target_id: str, actor_id: str) -> list[dict[str, Any]]:
        matches = [
            row
            for row in self.documents.values()
            if not row["metadata"].get("is_deleted", False)
            and row["link"]["target_type"] == target_type
            and row["link"]["target_id"] == target_id
        ]
        updated: list[dict[str, Any]] = []
        for document in matches:
            updated.append(await self.lock_document(document["id"], actor_id))
        return updated

    async def handle_parent_deleted(self, target_type: str, target_id: str, policy: str, actor_id: str) -> list[dict[str, Any]]:
        matches = [
            row
            for row in self.documents.values()
            if not row["metadata"].get("is_deleted", False)
            and row["link"]["target_type"] == target_type
            and row["link"]["target_id"] == target_id
        ]
        updated: list[dict[str, Any]] = []
        for document in matches:
            if policy == "cascade":
                document["state"]["status"] = DocumentStatus.archived.value
                document["metadata"]["is_deleted"] = True
                document["metadata"]["archived_at"] = iso_now()
                document["working_revision_id"] = None
            else:
                document["link"]["target_id"] = f"orphan:{target_id}"
                document["link"]["deep_link"] = "/udms/documents"
            document["metadata"]["updated_at"] = iso_now()
            document["updated_by"] = actor_id
            updated.append(deepcopy(document))
        return updated

    async def append_audit_entry(self, *, action: str, target_type: str, target_id: str, actor_id: str, detail: str) -> None:
        self.audit_logs.append(
            {
                "id": new_id("audit"),
                "action": action,
                "target_type": target_type,
                "target_id": target_id,
                "actor_id": actor_id,
                "detail": detail,
                "created_at": iso_now(),
            }
        )
