from fastapi import APIRouter, Depends

from app.dependencies import get_current_user, get_udms_service
from app.modules.udms.schemas import ApprovalTemplate
from app.modules.udms.service import UdmsService

router = APIRouter()


@router.get("/approval-templates", response_model=list[ApprovalTemplate])
async def list_approval_templates(
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> list[ApprovalTemplate]:
    templates = await service.list_approval_templates(current_user)
    return [ApprovalTemplate.model_validate(template) for template in templates]
