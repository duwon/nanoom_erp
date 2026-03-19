from datetime import datetime, timezone
from typing import Protocol

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, ReturnDocument

from app.schemas.display import DisplayState
from app.schemas.order_item import OrderItem, OrderItemUpdate


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class OrderItemNotFoundError(Exception):
    pass


class WorshipRepository(Protocol):
    async def ensure_indexes(self) -> None: ...

    async def seed_defaults_if_empty(self) -> None: ...

    async def list_order_items(self) -> list[OrderItem]: ...

    async def update_order_item(
        self,
        item_id: str,
        payload: OrderItemUpdate,
    ) -> OrderItem: ...

    async def activate_order_item(self, item_id: str) -> OrderItem: ...

    async def get_display_state(self) -> DisplayState: ...


class MongoWorshipRepository:
    def __init__(self, database: AsyncIOMotorDatabase):
        self.collection = database["order_items"]

    async def ensure_indexes(self) -> None:
        await self.collection.create_index([("id", ASCENDING)], unique=True)
        await self.collection.create_index([("order", ASCENDING)], unique=True)
        await self.collection.create_index([("isActive", ASCENDING)])

    async def seed_defaults_if_empty(self) -> None:
        if await self.collection.count_documents({}) > 0:
            return

        now = utcnow()
        await self.collection.insert_many(
            [
                {
                    "id": "opening",
                    "title": "예배 시작",
                    "order": 1,
                    "content": "예배를 여는 찬양\n모든 호흡이 주를 찬양해",
                    "isActive": True,
                    "updatedAt": now,
                },
                {
                    "id": "praise",
                    "title": "찬양",
                    "order": 2,
                    "content": "주님만이 나의 힘\n주님만이 나의 노래",
                    "isActive": False,
                    "updatedAt": now,
                },
                {
                    "id": "sermon",
                    "title": "말씀",
                    "order": 3,
                    "content": "오늘의 말씀 본문이 여기에 표시됩니다.",
                    "isActive": False,
                    "updatedAt": now,
                },
                {
                    "id": "closing",
                    "title": "축도",
                    "order": 4,
                    "content": "주 예수 그리스도의 은혜와\n하나님의 사랑과\n성령의 교통하심이 함께 하시길 바랍니다.",
                    "isActive": False,
                    "updatedAt": now,
                },
            ]
        )

    async def list_order_items(self) -> list[OrderItem]:
        documents = (
            await self.collection.find({}, {"_id": False}).sort("order", ASCENDING).to_list(None)
        )
        return [OrderItem.model_validate(document) for document in documents]

    async def update_order_item(
        self,
        item_id: str,
        payload: OrderItemUpdate,
    ) -> OrderItem:
        updated = await self.collection.find_one_and_update(
            {"id": item_id},
            {
                "$set": {
                    "title": payload.title,
                    "content": payload.content,
                    "updatedAt": utcnow(),
                }
            },
            projection={"_id": False},
            return_document=ReturnDocument.AFTER,
        )
        if updated is None:
            raise OrderItemNotFoundError(f"Order item '{item_id}' was not found.")
        return OrderItem.model_validate(updated)

    async def activate_order_item(self, item_id: str) -> OrderItem:
        existing = await self.collection.find_one({"id": item_id}, {"_id": False})
        if existing is None:
            raise OrderItemNotFoundError(f"Order item '{item_id}' was not found.")

        await self.collection.update_many({}, {"$set": {"isActive": False}})
        updated = await self.collection.find_one_and_update(
            {"id": item_id},
            {
                "$set": {
                    "isActive": True,
                    "updatedAt": utcnow(),
                }
            },
            projection={"_id": False},
            return_document=ReturnDocument.AFTER,
        )
        return OrderItem.model_validate(updated)

    async def get_display_state(self) -> DisplayState:
        document = await self.collection.find_one({"isActive": True}, {"_id": False})
        if document is None:
            return DisplayState(
                activeItemId=None,
                title="송출 대기 중",
                content="관리자 화면에서 순서를 선택해 주세요.",
                updatedAt=None,
            )

        item = OrderItem.model_validate(document)
        return DisplayState(
            activeItemId=item.id,
            title=item.title,
            content=item.content,
            updatedAt=item.updatedAt,
        )
