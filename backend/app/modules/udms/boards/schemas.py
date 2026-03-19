from pydantic import BaseModel, Field


class BoardUpsert(BaseModel):
    name: str = Field(min_length=1)
    description: str = ""
    isActive: bool = True
