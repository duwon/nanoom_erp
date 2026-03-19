from pydantic import BaseModel, Field


class ApprovalCreate(BaseModel):
    approverId: str = Field(min_length=1)
    status: str = "pending"
    comment: str = ""
