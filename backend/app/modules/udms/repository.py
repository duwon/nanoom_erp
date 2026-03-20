from __future__ import annotations

from copy import deepcopy
from typing import Protocol

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, ReturnDocument

from app.core.store import ConflictError, NotFoundError, iso_now, new_id
from app.modules.udms.schemas import BoardPermissionAction, DocumentStatus, PermissionSubjectType


DEFAULT_BOARD_ID = "board-notice"
DEFAULT_DOC_ID = "doc-worship-guide"


def _seed_board(now: str) -> dict:
    return {
        "id": DEFAULT_BOARD_ID,
        "name": "공지사항",
        "description": "교회 공지 및 안내 문서를 관리합니다.",
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }


def _seed_document(now: str) -> dict:
    return {
        "id": DEFAULT_DOC_ID,
        "origin_doc_id": DEFAULT_DOC_ID,
        "prev_doc_id": None,
        "version_number": 1,
        "board_id": DEFAULT_BOARD_ID,
        "title": "주일 예배 순서",
        "content": "<p>예배 순서와 자막, 첨부파일을 관리하는 문서입니다.</p>",
        "status": DocumentStatus.published.value,
        "approval_template_id": "approval-general",
        "created_by": "system",
        "updated_by": "system",
        "created_at": now,
        "updated_at": now,
    }


def _seed_approval_templates(now: str) -> list[dict]:
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


def _seed_board_permissions(now: str) -> list[dict]:
    return [
        {
            "id": "perm-board-master",
            "board_id": DEFAULT_BOARD_ID,
            "subject_type": PermissionSubjectType.role.value,
            "subject_id": "master",
            "actions": [
                BoardPermissionAction.read.value,
                BoardPermissionAction.create.value,
                BoardPermissionAction.manage.value,
            ],
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": "perm-board-editor",
            "board_id": DEFAULT_BOARD_ID,
            "subject_type": PermissionSubjectType.role.value,
            "subject_id": "editor",
            "actions": [
                BoardPermissionAction.read.value,
                BoardPermissionAction.create.value,
            ],
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": "perm-board-member",
            "board_id": DEFAULT_BOARD_ID,
            "subject_type": PermissionSubjectType.role.value,
            "subject_id": "member",
            "actions": [BoardPermissionAction.read.value],
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": "perm-board-approver",
            "board_id": DEFAULT_BOARD_ID,
            "subject_type": PermissionSubjectType.role.value,
            "subject_id": "final_approver",
            "actions": [BoardPermissionAction.read.value],
            "created_at": now,
            "updated_at": now,
        },
    ]


class UdmsRepository(Protocol):
    async def ensure_indexes(self) -> None: ...

    async def seed_defaults_if_empty(self) -> None: ...

    async def list_boards(self) -> list[dict]: ...

    async def get_board(self, board_id: str) -> dict: ...

    async def create_board(self, payload: dict) -> dict: ...

    async def update_board(self, board_id: str, payload: dict) -> dict: ...

    async def list_board_permissions(self, board_id: str | None = None) -> list[dict]: ...

    async def replace_board_permissions(self, board_id: str, rules: list[dict]) -> list[dict]: ...

    async def list_approval_templates(self) -> list[dict]: ...

    async def list_documents(
        self,
        board_id: str | None = None,
        status: str | None = None,
        query: str | None = None,
    ) -> list[dict]: ...

    async def get_document(self, document_id: str) -> dict: ...

    async def create_document(self, payload: dict) -> dict: ...

    async def update_document(self, document_id: str, payload: dict) -> dict: ...

    async def publish_document(self, document_id: str, actor_id: str) -> dict: ...

    async def create_next_version(self, document_id: str, actor_id: str) -> dict: ...

    async def list_versions(self, origin_doc_id: str) -> list[dict]: ...

    async def list_shares(self, document_id: str) -> list[dict]: ...

    async def replace_shares(self, document_id: str, items: list[dict], actor_id: str) -> list[dict]: ...

    async def list_all_shares(self) -> list[dict]: ...

    async def list_attachments(self, document_id: str) -> list[dict]: ...

    async def create_attachment(self, document_id: str, payload: dict) -> dict: ...

    async def get_attachment(self, attachment_id: str) -> dict: ...

    async def delete_attachment(self, attachment_id: str) -> dict: ...

    async def count_attachment_refs(self, storage_key: str) -> int: ...


class MongoUdmsRepository:
    def __init__(self, database: AsyncIOMotorDatabase):
        self.boards = database["udms_boards"]
        self.documents = database["udms_documents"]
        self.board_permissions = database["udms_board_permissions"]
        self.approval_templates = database["udms_approval_templates"]
        self.shares = database["udms_shares"]
        self.attachments = database["udms_attachments"]

    async def ensure_indexes(self) -> None:
        await self.boards.create_index([("id", ASCENDING)], unique=True)
        await self.documents.create_index([("id", ASCENDING)], unique=True)
        await self.documents.create_index(
            [("origin_doc_id", ASCENDING), ("version_number", ASCENDING)],
            unique=True,
        )
        await self.documents.create_index([("board_id", ASCENDING), ("updated_at", ASCENDING)])
        await self.documents.create_index([("status", ASCENDING)])
        await self.board_permissions.create_index([("id", ASCENDING)], unique=True)
        await self.board_permissions.create_index([("board_id", ASCENDING)])
        await self.approval_templates.create_index([("id", ASCENDING)], unique=True)
        await self.shares.create_index([("id", ASCENDING)], unique=True)
        await self.shares.create_index([("doc_id", ASCENDING)])
        await self.attachments.create_index([("id", ASCENDING)], unique=True)
        await self.attachments.create_index([("doc_id", ASCENDING)])
        await self.attachments.create_index([("storage_key", ASCENDING)])

    async def seed_defaults_if_empty(self) -> None:
        if await self.boards.count_documents({}) > 0:
            return
        now = iso_now()
        await self.boards.insert_one(_seed_board(now))
        await self.documents.insert_one(_seed_document(now))
        await self.board_permissions.insert_many(_seed_board_permissions(now))
        await self.approval_templates.insert_many(_seed_approval_templates(now))

    async def list_boards(self) -> list[dict]:
        return await self.boards.find({}, {"_id": False}).sort("name", ASCENDING).to_list(None)

    async def get_board(self, board_id: str) -> dict:
        board = await self.boards.find_one({"id": board_id}, {"_id": False})
        if board is None:
            raise NotFoundError(f"Board '{board_id}' was not found.")
        return board

    async def create_board(self, payload: dict) -> dict:
        board = {
            "id": payload.get("id") or new_id("board"),
            "name": payload["name"],
            "description": payload.get("description", ""),
            "is_active": payload.get("is_active", True),
            "created_at": iso_now(),
            "updated_at": iso_now(),
        }
        await self.boards.insert_one(deepcopy(board))
        return board

    async def update_board(self, board_id: str, payload: dict) -> dict:
        updated = await self.boards.find_one_and_update(
            {"id": board_id},
            {
                "$set": {
                    "name": payload["name"],
                    "description": payload.get("description", ""),
                    "is_active": payload.get("is_active", True),
                    "updated_at": iso_now(),
                }
            },
            projection={"_id": False},
            return_document=ReturnDocument.AFTER,
        )
        if updated is None:
            raise NotFoundError(f"Board '{board_id}' was not found.")
        return updated

    async def list_board_permissions(self, board_id: str | None = None) -> list[dict]:
        query = {"board_id": board_id} if board_id else {}
        return await self.board_permissions.find(query, {"_id": False}).sort(
            [("board_id", ASCENDING), ("subject_type", ASCENDING), ("subject_id", ASCENDING)]
        ).to_list(None)

    async def replace_board_permissions(self, board_id: str, rules: list[dict]) -> list[dict]:
        await self.get_board(board_id)
        await self.board_permissions.delete_many({"board_id": board_id})
        now = iso_now()
        rows = [
            {
                "id": new_id("perm"),
                "board_id": board_id,
                "subject_type": row["subject_type"],
                "subject_id": row["subject_id"],
                "actions": row["actions"],
                "created_at": now,
                "updated_at": now,
            }
            for row in rules
        ]
        if rows:
            await self.board_permissions.insert_many(deepcopy(rows))
        return rows

    async def list_approval_templates(self) -> list[dict]:
        return await self.approval_templates.find({"is_active": True}, {"_id": False}).sort(
            "name", ASCENDING
        ).to_list(None)

    async def list_documents(
        self,
        board_id: str | None = None,
        status: str | None = None,
        query: str | None = None,
    ) -> list[dict]:
        mongo_query: dict = {}
        if board_id:
            mongo_query["board_id"] = board_id
        if status:
            mongo_query["status"] = status
        if query:
            mongo_query["$or"] = [
                {"title": {"$regex": query, "$options": "i"}},
                {"content": {"$regex": query, "$options": "i"}},
            ]
        return await self.documents.find(mongo_query, {"_id": False}).sort("updated_at", -1).to_list(None)

    async def get_document(self, document_id: str) -> dict:
        document = await self.documents.find_one({"id": document_id}, {"_id": False})
        if document is None:
            raise NotFoundError(f"Document '{document_id}' was not found.")
        return document

    async def create_document(self, payload: dict) -> dict:
        await self.get_board(payload["board_id"])
        now = iso_now()
        document_id = payload.get("id") or new_id("doc")
        document = {
            "id": document_id,
            "origin_doc_id": document_id,
            "prev_doc_id": None,
            "version_number": 1,
            "board_id": payload["board_id"],
            "title": payload["title"],
            "content": payload.get("content", ""),
            "status": DocumentStatus.draft.value,
            "approval_template_id": payload.get("approval_template_id"),
            "created_by": payload["actor_id"],
            "updated_by": payload["actor_id"],
            "created_at": now,
            "updated_at": now,
        }
        await self.documents.insert_one(deepcopy(document))
        return document

    async def update_document(self, document_id: str, payload: dict) -> dict:
        existing = await self.get_document(document_id)
        if existing["status"] != DocumentStatus.draft.value:
            raise ConflictError("Only draft documents can be updated.")
        board_id = payload.get("board_id", existing["board_id"])
        await self.get_board(board_id)
        updated = await self.documents.find_one_and_update(
            {"id": document_id},
            {
                "$set": {
                    "board_id": board_id,
                    "title": payload.get("title", existing["title"]),
                    "content": payload.get("content", existing["content"]),
                    "approval_template_id": payload.get(
                        "approval_template_id", existing.get("approval_template_id")
                    ),
                    "updated_by": payload["actor_id"],
                    "updated_at": iso_now(),
                }
            },
            projection={"_id": False},
            return_document=ReturnDocument.AFTER,
        )
        return updated

    async def publish_document(self, document_id: str, actor_id: str) -> dict:
        existing = await self.get_document(document_id)
        if existing["status"] != DocumentStatus.draft.value:
            raise ConflictError("Only draft documents can be published.")
        now = iso_now()
        await self.documents.update_many(
            {
                "origin_doc_id": existing["origin_doc_id"],
                "status": DocumentStatus.published.value,
                "id": {"$ne": document_id},
            },
            {
                "$set": {
                    "status": DocumentStatus.superseded.value,
                    "updated_by": actor_id,
                    "updated_at": now,
                }
            },
        )
        published = await self.documents.find_one_and_update(
            {"id": document_id},
            {
                "$set": {
                    "status": DocumentStatus.published.value,
                    "updated_by": actor_id,
                    "updated_at": now,
                }
            },
            projection={"_id": False},
            return_document=ReturnDocument.AFTER,
        )
        return published

    async def create_next_version(self, document_id: str, actor_id: str) -> dict:
        source = await self.get_document(document_id)
        if source["status"] != DocumentStatus.published.value:
            raise ConflictError("New versions can only be created from published documents.")
        now = iso_now()
        new_document_id = new_id("doc")
        next_document = {
            "id": new_document_id,
            "origin_doc_id": source["origin_doc_id"],
            "prev_doc_id": source["id"],
            "version_number": source["version_number"] + 1,
            "board_id": source["board_id"],
            "title": source["title"],
            "content": source["content"],
            "status": DocumentStatus.draft.value,
            "approval_template_id": source.get("approval_template_id"),
            "created_by": actor_id,
            "updated_by": actor_id,
            "created_at": now,
            "updated_at": now,
        }
        await self.documents.insert_one(deepcopy(next_document))

        shares = await self.list_shares(source["id"])
        if shares:
            await self.shares.insert_many(
                [
                    {
                        **deepcopy(share),
                        "id": new_id("share"),
                        "doc_id": new_document_id,
                        "created_by": actor_id,
                        "created_at": now,
                        "updated_at": now,
                    }
                    for share in shares
                ]
            )

        attachments = await self.list_attachments(source["id"])
        if attachments:
            await self.attachments.insert_many(
                [
                    {
                        **deepcopy(attachment),
                        "id": new_id("att"),
                        "doc_id": new_document_id,
                        "created_by": actor_id,
                        "created_at": now,
                        "updated_at": now,
                    }
                    for attachment in attachments
                ]
            )
        return next_document

    async def list_versions(self, origin_doc_id: str) -> list[dict]:
        return await self.documents.find({"origin_doc_id": origin_doc_id}, {"_id": False}).sort(
            "version_number", -1
        ).to_list(None)

    async def list_shares(self, document_id: str) -> list[dict]:
        return await self.shares.find({"doc_id": document_id}, {"_id": False}).sort(
            [("target_type", ASCENDING), ("target_id", ASCENDING)]
        ).to_list(None)

    async def replace_shares(self, document_id: str, items: list[dict], actor_id: str) -> list[dict]:
        await self.get_document(document_id)
        await self.shares.delete_many({"doc_id": document_id})
        now = iso_now()
        rows = [
            {
                "id": new_id("share"),
                "doc_id": document_id,
                "target_type": row["target_type"],
                "target_id": row["target_id"],
                "permission": row["permission"],
                "created_by": actor_id,
                "created_at": now,
                "updated_at": now,
            }
            for row in items
        ]
        if rows:
            await self.shares.insert_many(deepcopy(rows))
        return rows

    async def list_all_shares(self) -> list[dict]:
        return await self.shares.find({}, {"_id": False}).to_list(None)

    async def list_attachments(self, document_id: str) -> list[dict]:
        return await self.attachments.find({"doc_id": document_id}, {"_id": False}).sort(
            "created_at", ASCENDING
        ).to_list(None)

    async def create_attachment(self, document_id: str, payload: dict) -> dict:
        await self.get_document(document_id)
        now = iso_now()
        attachment = {
            "id": new_id("att"),
            "doc_id": document_id,
            "storage_key": payload["storage_key"],
            "file_name": payload["file_name"],
            "mime_type": payload.get("mime_type", "application/octet-stream"),
            "size_bytes": payload.get("size_bytes", 0),
            "created_by": payload["actor_id"],
            "created_at": now,
            "updated_at": now,
        }
        await self.attachments.insert_one(deepcopy(attachment))
        return attachment

    async def get_attachment(self, attachment_id: str) -> dict:
        attachment = await self.attachments.find_one({"id": attachment_id}, {"_id": False})
        if attachment is None:
            raise NotFoundError(f"Attachment '{attachment_id}' was not found.")
        return attachment

    async def delete_attachment(self, attachment_id: str) -> dict:
        deleted = await self.attachments.find_one_and_delete({"id": attachment_id}, projection={"_id": False})
        if deleted is None:
            raise NotFoundError(f"Attachment '{attachment_id}' was not found.")
        return deleted

    async def count_attachment_refs(self, storage_key: str) -> int:
        return await self.attachments.count_documents({"storage_key": storage_key})


class InMemoryUdmsRepository:
    def __init__(self) -> None:
        self.boards: dict[str, dict] = {}
        self.documents: dict[str, dict] = {}
        self.board_permissions: dict[str, dict] = {}
        self.approval_templates: dict[str, dict] = {}
        self.shares: dict[str, dict] = {}
        self.attachments: dict[str, dict] = {}

    @classmethod
    def bootstrap(cls) -> "InMemoryUdmsRepository":
        repo = cls()
        now = iso_now()
        board = _seed_board(now)
        document = _seed_document(now)
        repo.boards[board["id"]] = board
        repo.documents[document["id"]] = document
        for rule in _seed_board_permissions(now):
            repo.board_permissions[rule["id"]] = rule
        for template in _seed_approval_templates(now):
            repo.approval_templates[template["id"]] = template
        return repo

    async def ensure_indexes(self) -> None:
        return None

    async def seed_defaults_if_empty(self) -> None:
        return None

    async def list_boards(self) -> list[dict]:
        return [deepcopy(row) for row in sorted(self.boards.values(), key=lambda value: value["name"])]

    async def get_board(self, board_id: str) -> dict:
        board = self.boards.get(board_id)
        if board is None:
            raise NotFoundError(f"Board '{board_id}' was not found.")
        return deepcopy(board)

    async def create_board(self, payload: dict) -> dict:
        board = {
            "id": payload.get("id") or new_id("board"),
            "name": payload["name"],
            "description": payload.get("description", ""),
            "is_active": payload.get("is_active", True),
            "created_at": iso_now(),
            "updated_at": iso_now(),
        }
        self.boards[board["id"]] = board
        return deepcopy(board)

    async def update_board(self, board_id: str, payload: dict) -> dict:
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

    async def list_board_permissions(self, board_id: str | None = None) -> list[dict]:
        rows = list(self.board_permissions.values())
        if board_id:
            rows = [row for row in rows if row["board_id"] == board_id]
        rows.sort(key=lambda row: (row["board_id"], row["subject_type"], row["subject_id"]))
        return [deepcopy(row) for row in rows]

    async def replace_board_permissions(self, board_id: str, rules: list[dict]) -> list[dict]:
        await self.get_board(board_id)
        for key, value in list(self.board_permissions.items()):
            if value["board_id"] == board_id:
                self.board_permissions.pop(key)
        now = iso_now()
        rows = []
        for row in rules:
            created = {
                "id": new_id("perm"),
                "board_id": board_id,
                "subject_type": row["subject_type"],
                "subject_id": row["subject_id"],
                "actions": row["actions"],
                "created_at": now,
                "updated_at": now,
            }
            self.board_permissions[created["id"]] = created
            rows.append(created)
        return [deepcopy(row) for row in rows]

    async def list_approval_templates(self) -> list[dict]:
        return [
            deepcopy(row)
            for row in sorted(self.approval_templates.values(), key=lambda value: value["name"])
            if row["is_active"]
        ]

    async def list_documents(
        self,
        board_id: str | None = None,
        status: str | None = None,
        query: str | None = None,
    ) -> list[dict]:
        rows = list(self.documents.values())
        if board_id:
            rows = [row for row in rows if row["board_id"] == board_id]
        if status:
            rows = [row for row in rows if row["status"] == status]
        if query:
            lowered = query.lower()
            rows = [
                row
                for row in rows
                if lowered in row["title"].lower() or lowered in row["content"].lower()
            ]
        rows.sort(key=lambda row: row["updated_at"], reverse=True)
        return [deepcopy(row) for row in rows]

    async def get_document(self, document_id: str) -> dict:
        document = self.documents.get(document_id)
        if document is None:
            raise NotFoundError(f"Document '{document_id}' was not found.")
        return deepcopy(document)

    async def create_document(self, payload: dict) -> dict:
        await self.get_board(payload["board_id"])
        now = iso_now()
        document = {
            "id": payload.get("id") or new_id("doc"),
            "origin_doc_id": payload.get("id") or new_id("doc"),
            "prev_doc_id": None,
            "version_number": 1,
            "board_id": payload["board_id"],
            "title": payload["title"],
            "content": payload.get("content", ""),
            "status": DocumentStatus.draft.value,
            "approval_template_id": payload.get("approval_template_id"),
            "created_by": payload["actor_id"],
            "updated_by": payload["actor_id"],
            "created_at": now,
            "updated_at": now,
        }
        document["origin_doc_id"] = document["id"]
        self.documents[document["id"]] = document
        return deepcopy(document)

    async def update_document(self, document_id: str, payload: dict) -> dict:
        document = self.documents.get(document_id)
        if document is None:
            raise NotFoundError(f"Document '{document_id}' was not found.")
        if document["status"] != DocumentStatus.draft.value:
            raise ConflictError("Only draft documents can be updated.")
        board_id = payload.get("board_id", document["board_id"])
        await self.get_board(board_id)
        document.update(
            {
                "board_id": board_id,
                "title": payload.get("title", document["title"]),
                "content": payload.get("content", document["content"]),
                "approval_template_id": payload.get(
                    "approval_template_id", document.get("approval_template_id")
                ),
                "updated_by": payload["actor_id"],
                "updated_at": iso_now(),
            }
        )
        return deepcopy(document)

    async def publish_document(self, document_id: str, actor_id: str) -> dict:
        document = self.documents.get(document_id)
        if document is None:
            raise NotFoundError(f"Document '{document_id}' was not found.")
        if document["status"] != DocumentStatus.draft.value:
            raise ConflictError("Only draft documents can be published.")
        now = iso_now()
        for row in self.documents.values():
            if (
                row["origin_doc_id"] == document["origin_doc_id"]
                and row["status"] == DocumentStatus.published.value
                and row["id"] != document_id
            ):
                row["status"] = DocumentStatus.superseded.value
                row["updated_by"] = actor_id
                row["updated_at"] = now
        document["status"] = DocumentStatus.published.value
        document["updated_by"] = actor_id
        document["updated_at"] = now
        return deepcopy(document)

    async def create_next_version(self, document_id: str, actor_id: str) -> dict:
        source = self.documents.get(document_id)
        if source is None:
            raise NotFoundError(f"Document '{document_id}' was not found.")
        if source["status"] != DocumentStatus.published.value:
            raise ConflictError("New versions can only be created from published documents.")
        now = iso_now()
        document = {
            "id": new_id("doc"),
            "origin_doc_id": source["origin_doc_id"],
            "prev_doc_id": source["id"],
            "version_number": source["version_number"] + 1,
            "board_id": source["board_id"],
            "title": source["title"],
            "content": source["content"],
            "status": DocumentStatus.draft.value,
            "approval_template_id": source.get("approval_template_id"),
            "created_by": actor_id,
            "updated_by": actor_id,
            "created_at": now,
            "updated_at": now,
        }
        self.documents[document["id"]] = document
        for share in await self.list_shares(source["id"]):
            cloned = {
                **share,
                "id": new_id("share"),
                "doc_id": document["id"],
                "created_by": actor_id,
                "created_at": now,
                "updated_at": now,
            }
            self.shares[cloned["id"]] = cloned
        for attachment in await self.list_attachments(source["id"]):
            cloned = {
                **attachment,
                "id": new_id("att"),
                "doc_id": document["id"],
                "created_by": actor_id,
                "created_at": now,
                "updated_at": now,
            }
            self.attachments[cloned["id"]] = cloned
        return deepcopy(document)

    async def list_versions(self, origin_doc_id: str) -> list[dict]:
        rows = [row for row in self.documents.values() if row["origin_doc_id"] == origin_doc_id]
        rows.sort(key=lambda row: row["version_number"], reverse=True)
        return [deepcopy(row) for row in rows]

    async def list_shares(self, document_id: str) -> list[dict]:
        rows = [row for row in self.shares.values() if row["doc_id"] == document_id]
        rows.sort(key=lambda row: (row["target_type"], row["target_id"]))
        return [deepcopy(row) for row in rows]

    async def replace_shares(self, document_id: str, items: list[dict], actor_id: str) -> list[dict]:
        await self.get_document(document_id)
        for key, value in list(self.shares.items()):
            if value["doc_id"] == document_id:
                self.shares.pop(key)
        now = iso_now()
        rows = []
        for row in items:
            share = {
                "id": new_id("share"),
                "doc_id": document_id,
                "target_type": row["target_type"],
                "target_id": row["target_id"],
                "permission": row["permission"],
                "created_by": actor_id,
                "created_at": now,
                "updated_at": now,
            }
            self.shares[share["id"]] = share
            rows.append(share)
        return [deepcopy(row) for row in rows]

    async def list_all_shares(self) -> list[dict]:
        return [deepcopy(row) for row in self.shares.values()]

    async def list_attachments(self, document_id: str) -> list[dict]:
        rows = [row for row in self.attachments.values() if row["doc_id"] == document_id]
        rows.sort(key=lambda row: row["created_at"])
        return [deepcopy(row) for row in rows]

    async def create_attachment(self, document_id: str, payload: dict) -> dict:
        await self.get_document(document_id)
        now = iso_now()
        attachment = {
            "id": new_id("att"),
            "doc_id": document_id,
            "storage_key": payload["storage_key"],
            "file_name": payload["file_name"],
            "mime_type": payload.get("mime_type", "application/octet-stream"),
            "size_bytes": payload.get("size_bytes", 0),
            "created_by": payload["actor_id"],
            "created_at": now,
            "updated_at": now,
        }
        self.attachments[attachment["id"]] = attachment
        return deepcopy(attachment)

    async def get_attachment(self, attachment_id: str) -> dict:
        attachment = self.attachments.get(attachment_id)
        if attachment is None:
            raise NotFoundError(f"Attachment '{attachment_id}' was not found.")
        return deepcopy(attachment)

    async def delete_attachment(self, attachment_id: str) -> dict:
        attachment = self.attachments.pop(attachment_id, None)
        if attachment is None:
            raise NotFoundError(f"Attachment '{attachment_id}' was not found.")
        return deepcopy(attachment)

    async def count_attachment_refs(self, storage_key: str) -> int:
        return sum(1 for row in self.attachments.values() if row["storage_key"] == storage_key)
