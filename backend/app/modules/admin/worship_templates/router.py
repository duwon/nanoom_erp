from fastapi import APIRouter, Depends, HTTPException, status

from app.core.store import ConflictError, NotFoundError
from app.dependencies import get_worship_service
from app.modules.admin.dependencies import require_admin
from app.modules.worship.schemas import WorshipTemplate, WorshipTemplateUpsert
from app.services.worship_service import WorshipService

router = APIRouter()


@router.get("/worship-templates", response_model=list[WorshipTemplate])
async def list_worship_templates(
    current_user: dict = Depends(require_admin),
    service: WorshipService = Depends(get_worship_service),
) -> list[WorshipTemplate]:
    del current_user
    return await service.list_templates()


@router.post("/worship-templates", response_model=WorshipTemplate)
async def create_worship_template(
    payload: WorshipTemplateUpsert,
    current_user: dict = Depends(require_admin),
    service: WorshipService = Depends(get_worship_service),
) -> WorshipTemplate:
    del current_user
    try:
        return await service.create_template(payload)
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.put("/worship-templates/{template_id}", response_model=WorshipTemplate)
async def update_worship_template(
    template_id: str,
    payload: WorshipTemplateUpsert,
    current_user: dict = Depends(require_admin),
    service: WorshipService = Depends(get_worship_service),
) -> WorshipTemplate:
    del current_user
    try:
        return await service.update_template(template_id, payload)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
