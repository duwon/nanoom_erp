from pydantic import BaseModel, Field


class ShareCreate(BaseModel):
    targetType: str = Field(min_length=1)
    targetId: str = Field(min_length=1)
    permission: str = "read"
