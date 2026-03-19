from pydantic import BaseModel, Field


class DocumentCreate(BaseModel):
    boardId: str = Field(min_length=1)
    title: str = Field(min_length=1)
    content: str = ""


class DocumentUpdate(BaseModel):
    boardId: str | None = None
    title: str | None = None
    content: str | None = None


class AttachmentCreate(BaseModel):
    filename: str = Field(min_length=1)
    mimeType: str = "application/octet-stream"
    sizeBytes: int = 0
    url: str = ""
