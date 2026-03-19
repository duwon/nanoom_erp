from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from uuid import uuid4


class AppStoreError(Exception):
    pass


class NotFoundError(AppStoreError):
    pass


class ConflictError(AppStoreError):
    pass


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def iso_now() -> str:
    return utcnow().isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


class InMemoryAppStore:
    def __init__(self) -> None:
        now = iso_now()

        self.lookups = {
            "departments": [
                {"code": "committee", "name": "위원회"},
                {"code": "team", "name": "팀"},
                {"code": "member", "name": "팀원"},
            ],
            "positions": [
                {"code": "senior_pastor", "name": "담임목사"},
                {"code": "associate_pastor", "name": "부목사"},
                {"code": "minister", "name": "전도사"},
                {"code": "elder", "name": "장로"},
                {"code": "deacon_licensed", "name": "안수집사"},
                {"code": "deaconess", "name": "권사"},
                {"code": "deacon", "name": "집사"},
                {"code": "member", "name": "성도"},
                {"code": "student", "name": "학생"},
                {"code": "young_adult", "name": "청년"},
            ],
        }

        self.users: dict[str, dict] = {
            "user-admin": {
                "id": "user-admin",
                "username": "admin",
                "password": "admin123",
                "name": "관리자",
                "department": "위원회",
                "position": "장로",
                "roles": ["admin"],
                "isActive": True,
                "createdAt": now,
                "updatedAt": now,
            },
            "user-editor": {
                "id": "user-editor",
                "username": "editor",
                "password": "editor123",
                "name": "예배팀",
                "department": "팀",
                "position": "전도사",
                "roles": ["editor"],
                "isActive": True,
                "createdAt": now,
                "updatedAt": now,
            },
            "user-viewer": {
                "id": "user-viewer",
                "username": "viewer",
                "password": "viewer123",
                "name": "성도",
                "department": "팀원",
                "position": "성도",
                "roles": ["viewer"],
                "isActive": True,
                "createdAt": now,
                "updatedAt": now,
            },
        }

        self.boards: dict[str, dict] = {
            "board-notice": {
                "id": "board-notice",
                "name": "공지사항",
                "description": "교회 공지 및 안내",
                "isActive": True,
                "createdAt": now,
                "updatedAt": now,
            }
        }

        self.documents: dict[str, dict] = {
            "doc-worship-guide": {
                "id": "doc-worship-guide",
                "boardId": "board-notice",
                "title": "주일 예배 순서",
                "content": "예배 순서와 자막, 첨부파일을 관리하는 문서입니다.",
                "version": 1,
                "createdBy": "user-admin",
                "updatedBy": "user-admin",
                "createdAt": now,
                "updatedAt": now,
                "versions": [
                    {
                        "version": 1,
                        "title": "주일 예배 순서",
                        "content": "예배 순서와 자막, 첨부파일을 관리하는 문서입니다.",
                        "createdBy": "user-admin",
                        "createdAt": now,
                    }
                ],
                "attachments": [],
                "shares": [],
                "approvals": [],
                "permissions": [
                    {
                        "subjectType": "role",
                        "subjectId": "admin",
                        "actions": ["read", "write", "share", "approve"],
                    }
                ],
            }
        }

        self.worship_templates: dict[str, dict] = {
            "template-default": {
                "id": "template-default",
                "name": "기본 예배 템플릿",
                "description": "예배 순서와 자막 입력의 시작점",
                "body": "예배 순서 템플릿 본문",
                "createdAt": now,
                "updatedAt": now,
            }
        }

        self.permissions: dict[str, list[dict]] = {
            "document:doc-worship-guide": deepcopy(self.documents["doc-worship-guide"]["permissions"]),
        }

        self.audit_logs: list[dict] = [
            {
                "id": "audit-seed",
                "action": "seed",
                "targetType": "document",
                "targetId": "doc-worship-guide",
                "actorId": "system",
                "detail": "Seeded default worship guide document",
                "createdAt": now,
            }
        ]

    @classmethod
    def bootstrap(cls) -> "InMemoryAppStore":
        return cls()

    def _copy(self, value: dict | list[dict] | None) -> dict | list[dict] | None:
        if value is None:
            return None
        return deepcopy(value)

    def _audit(
        self,
        action: str,
        target_type: str,
        target_id: str,
        actor_id: str,
        detail: str,
    ) -> None:
        self.audit_logs.append(
            {
                "id": new_id("audit"),
                "action": action,
                "targetType": target_type,
                "targetId": target_id,
                "actorId": actor_id,
                "detail": detail,
                "createdAt": iso_now(),
            }
        )

    def list_users(self) -> list[dict]:
        return [self._sanitize_user(user) for user in self.users.values()]

    def _sanitize_user(self, user: dict) -> dict:
        result = deepcopy(user)
        result.pop("password", None)
        return result

    def get_user(self, user_id: str) -> dict:
        user = self.users.get(user_id)
        if user is None:
            raise NotFoundError(f"User '{user_id}' was not found.")
        return self._sanitize_user(user)

    def find_user_by_username(self, username: str) -> dict | None:
        for user in self.users.values():
            if user["username"] == username:
                return user
        return None

    def create_user(self, payload: dict) -> dict:
        if self.find_user_by_username(payload["username"]) is not None:
            raise ConflictError(f"User name '{payload['username']}' already exists.")

        now = iso_now()
        user_id = payload.get("id") or new_id("user")
        user = {
            "id": user_id,
            "username": payload["username"],
            "password": payload["password"],
            "name": payload["name"],
            "department": payload["department"],
            "position": payload["position"],
            "roles": payload.get("roles", ["viewer"]),
            "isActive": payload.get("isActive", True),
            "createdAt": now,
            "updatedAt": now,
        }
        self.users[user_id] = user
        self._audit("create", "user", user_id, payload.get("actorId", user_id), "User created")
        return self._sanitize_user(user)

    def update_user(self, user_id: str, payload: dict) -> dict:
        user = self.users.get(user_id)
        if user is None:
            raise NotFoundError(f"User '{user_id}' was not found.")

        if "username" in payload:
            other = self.find_user_by_username(payload["username"])
            if other is not None and other["id"] != user_id:
                raise ConflictError(f"User name '{payload['username']}' already exists.")

        user.update(
            {
                key: value
                for key, value in payload.items()
                if key in {"username", "password", "name", "department", "position", "roles", "isActive"}
            }
        )
        user["updatedAt"] = iso_now()
        self._audit("update", "user", user_id, payload.get("actorId", user_id), "User updated")
        return self._sanitize_user(user)

    def list_boards(self) -> list[dict]:
        return [deepcopy(board) for board in self.boards.values()]

    def get_board(self, board_id: str) -> dict:
        board = self.boards.get(board_id)
        if board is None:
            raise NotFoundError(f"Board '{board_id}' was not found.")
        return deepcopy(board)

    def create_board(self, payload: dict) -> dict:
        board_id = payload.get("id") or new_id("board")
        if board_id in self.boards:
            raise ConflictError(f"Board '{board_id}' already exists.")
        board = {
            "id": board_id,
            "name": payload["name"],
            "description": payload.get("description", ""),
            "isActive": payload.get("isActive", True),
            "createdAt": iso_now(),
            "updatedAt": iso_now(),
        }
        self.boards[board_id] = board
        self._audit("create", "board", board_id, payload.get("actorId", "system"), "Board created")
        return deepcopy(board)

    def update_board(self, board_id: str, payload: dict) -> dict:
        board = self.boards.get(board_id)
        if board is None:
            raise NotFoundError(f"Board '{board_id}' was not found.")
        board.update({key: value for key, value in payload.items() if key in {"name", "description", "isActive"}})
        board["updatedAt"] = iso_now()
        self._audit("update", "board", board_id, payload.get("actorId", "system"), "Board updated")
        return deepcopy(board)

    def list_documents(self, board_id: str | None = None, query: str | None = None) -> list[dict]:
        documents = list(self.documents.values())
        if board_id is not None:
            documents = [doc for doc in documents if doc["boardId"] == board_id]
        if query:
            lowered = query.lower()
            documents = [
                doc
                for doc in documents
                if lowered in doc["title"].lower() or lowered in doc["content"].lower()
            ]
        return [deepcopy(doc) for doc in documents]

    def get_document(self, document_id: str) -> dict:
        document = self.documents.get(document_id)
        if document is None:
            raise NotFoundError(f"Document '{document_id}' was not found.")
        return deepcopy(document)

    def create_document(self, payload: dict) -> dict:
        board_id = payload["boardId"]
        if board_id not in self.boards:
            raise NotFoundError(f"Board '{board_id}' was not found.")

        now = iso_now()
        document_id = payload.get("id") or new_id("doc")
        document = {
            "id": document_id,
            "boardId": board_id,
            "title": payload["title"],
            "content": payload.get("content", ""),
            "version": 1,
            "createdBy": payload.get("actorId", "system"),
            "updatedBy": payload.get("actorId", "system"),
            "createdAt": now,
            "updatedAt": now,
            "versions": [
                {
                    "version": 1,
                    "title": payload["title"],
                    "content": payload.get("content", ""),
                    "createdBy": payload.get("actorId", "system"),
                    "createdAt": now,
                }
            ],
            "attachments": [],
            "shares": [],
            "approvals": [],
            "permissions": [
                {
                    "subjectType": "role",
                    "subjectId": "admin",
                    "actions": ["read", "write", "share", "approve"],
                }
            ],
        }
        self.documents[document_id] = document
        self.permissions[f"document:{document_id}"] = deepcopy(document["permissions"])
        self._audit("create", "document", document_id, document["createdBy"], "Document created")
        return deepcopy(document)

    def update_document(self, document_id: str, payload: dict) -> dict:
        document = self.documents.get(document_id)
        if document is None:
            raise NotFoundError(f"Document '{document_id}' was not found.")

        document["title"] = payload.get("title", document["title"])
        document["content"] = payload.get("content", document["content"])
        document["boardId"] = payload.get("boardId", document["boardId"])
        document["updatedBy"] = payload.get("actorId", document["updatedBy"])
        document["updatedAt"] = iso_now()
        document["version"] += 1
        document["versions"].append(
            {
                "version": document["version"],
                "title": document["title"],
                "content": document["content"],
                "createdBy": document["updatedBy"],
                "createdAt": document["updatedAt"],
            }
        )
        self._audit("update", "document", document_id, document["updatedBy"], "Document updated")
        return deepcopy(document)

    def list_document_versions(self, document_id: str) -> list[dict]:
        document = self.documents.get(document_id)
        if document is None:
            raise NotFoundError(f"Document '{document_id}' was not found.")
        return deepcopy(document["versions"])

    def add_attachment(self, document_id: str, payload: dict) -> dict:
        document = self.documents.get(document_id)
        if document is None:
            raise NotFoundError(f"Document '{document_id}' was not found.")
        attachment = {
            "id": payload.get("id") or new_id("att"),
            "filename": payload["filename"],
            "mimeType": payload.get("mimeType", "application/octet-stream"),
            "sizeBytes": payload.get("sizeBytes", 0),
            "url": payload.get("url", ""),
            "createdAt": iso_now(),
            "createdBy": payload.get("actorId", "system"),
        }
        document["attachments"].append(attachment)
        self._audit("create", "attachment", attachment["id"], attachment["createdBy"], f"Attached to {document_id}")
        return deepcopy(attachment)

    def delete_attachment(self, attachment_id: str) -> None:
        for document in self.documents.values():
            attachments = document["attachments"]
            for index, attachment in enumerate(attachments):
                if attachment["id"] == attachment_id:
                    attachments.pop(index)
                    self._audit("delete", "attachment", attachment_id, "system", f"Removed from {document['id']}")
                    return
        raise NotFoundError(f"Attachment '{attachment_id}' was not found.")

    def list_shares(self, document_id: str) -> list[dict]:
        document = self.documents.get(document_id)
        if document is None:
            raise NotFoundError(f"Document '{document_id}' was not found.")
        return deepcopy(document["shares"])

    def add_share(self, document_id: str, payload: dict) -> dict:
        document = self.documents.get(document_id)
        if document is None:
            raise NotFoundError(f"Document '{document_id}' was not found.")
        share = {
            "id": payload.get("id") or new_id("share"),
            "targetType": payload["targetType"],
            "targetId": payload["targetId"],
            "permission": payload.get("permission", "read"),
            "createdAt": iso_now(),
            "createdBy": payload.get("actorId", "system"),
        }
        document["shares"].append(share)
        self._audit("create", "share", share["id"], share["createdBy"], f"Shared {document_id}")
        return deepcopy(share)

    def list_approvals(self, document_id: str) -> list[dict]:
        document = self.documents.get(document_id)
        if document is None:
            raise NotFoundError(f"Document '{document_id}' was not found.")
        return deepcopy(document["approvals"])

    def add_approval(self, document_id: str, payload: dict) -> dict:
        document = self.documents.get(document_id)
        if document is None:
            raise NotFoundError(f"Document '{document_id}' was not found.")
        approval = {
            "id": payload.get("id") or new_id("approval"),
            "status": payload.get("status", "pending"),
            "approverId": payload["approverId"],
            "comment": payload.get("comment", ""),
            "createdAt": iso_now(),
            "createdBy": payload.get("actorId", "system"),
        }
        document["approvals"].append(approval)
        self._audit("create", "approval", approval["id"], approval["createdBy"], f"Approval added to {document_id}")
        return deepcopy(approval)

    def get_permissions(self, target_type: str, target_id: str) -> list[dict]:
        key = f"{target_type}:{target_id}"
        permissions = self.permissions.get(key)
        if permissions is None:
            return []
        return deepcopy(permissions)

    def set_permissions(self, target_type: str, target_id: str, payload: list[dict]) -> list[dict]:
        key = f"{target_type}:{target_id}"
        self.permissions[key] = deepcopy(payload)
        if target_type == "document" and target_id in self.documents:
            self.documents[target_id]["permissions"] = deepcopy(payload)
        self._audit("update", target_type, target_id, "system", "Permissions updated")
        return deepcopy(payload)

    def list_audit_logs(self) -> list[dict]:
        return [deepcopy(entry) for entry in sorted(self.audit_logs, key=lambda row: row["createdAt"], reverse=True)]

    def list_worship_templates(self) -> list[dict]:
        return [deepcopy(template) for template in self.worship_templates.values()]

    def create_worship_template(self, payload: dict) -> dict:
        template_id = payload.get("id") or new_id("template")
        if template_id in self.worship_templates:
            raise ConflictError(f"Template '{template_id}' already exists.")
        template = {
            "id": template_id,
            "name": payload["name"],
            "description": payload.get("description", ""),
            "body": payload.get("body", ""),
            "createdAt": iso_now(),
            "updatedAt": iso_now(),
        }
        self.worship_templates[template_id] = template
        self._audit("create", "worshipTemplate", template_id, "system", "Template created")
        return deepcopy(template)

    def update_worship_template(self, template_id: str, payload: dict) -> dict:
        template = self.worship_templates.get(template_id)
        if template is None:
            raise NotFoundError(f"Template '{template_id}' was not found.")
        template.update({key: value for key, value in payload.items() if key in {"name", "description", "body"}})
        template["updatedAt"] = iso_now()
        self._audit("update", "worshipTemplate", template_id, "system", "Template updated")
        return deepcopy(template)
