from pydantic import BaseModel, Field


class PermissionsPayload(BaseModel):
    permissions: list[dict] = Field(default_factory=list)
