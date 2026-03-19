from pydantic import BaseModel, Field


class WorshipTemplateUpsert(BaseModel):
    name: str = Field(min_length=1)
    description: str = ""
    body: str = ""
