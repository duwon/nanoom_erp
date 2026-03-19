from datetime import datetime

from pydantic import BaseModel, Field


class OrderItem(BaseModel):
    id: str
    title: str
    order: int
    content: str
    isActive: bool = False
    updatedAt: datetime


class OrderItemUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    content: str = Field(min_length=1, max_length=5000)
