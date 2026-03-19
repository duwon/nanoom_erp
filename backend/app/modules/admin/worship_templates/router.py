from fastapi import APIRouter, Depends, HTTPException, status

from app.core.store import NotFoundError
from app.dependencies import get_app_store
from app.modules.admin.dependencies import require_admin
from app.modules.admin.worship_templates.schemas import WorshipTemplateUpsert

router = APIRouter()


@router.get("/worship-templates")
async def list_worship_templates(
    current_user: dict = Depends(require_admin),
    store=Depends(get_app_store),
) -> list[dict]:
    return store.list_worship_templates()


@router.post("/worship-templates")
async def create_worship_template(
    payload: WorshipTemplateUpsert,
    current_user: dict = Depends(require_admin),
    store=Depends(get_app_store),
) -> dict:
    return store.create_worship_template(payload.model_dump())


@router.put("/worship-templates/{template_id}")
async def update_worship_template(
    template_id: str,
    payload: WorshipTemplateUpsert,
    current_user: dict = Depends(require_admin),
    store=Depends(get_app_store),
) -> dict:
    try:
        return store.update_worship_template(template_id, payload.model_dump())
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
