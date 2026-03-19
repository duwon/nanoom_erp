from datetime import datetime

from pydantic import BaseModel


class DisplayState(BaseModel):
    activeItemId: str | None
    title: str
    content: str
    updatedAt: datetime | None
