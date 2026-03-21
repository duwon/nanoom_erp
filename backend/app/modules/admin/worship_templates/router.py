from fastapi import APIRouter, Depends, HTTPException, status

from app.core.store import ConflictError, NotFoundError
from app.dependencies import get_worship_service
from app.modules.admin.dependencies import require_admin
from app.modules.worship.schemas import (
    WorshipInputTemplate,
    WorshipInputTemplateUpsert,
    WorshipSectionTypeDefinition,
    WorshipSectionTypeDefinitionUpsert,
    WorshipSlideTemplate,
    WorshipSlideTemplateUpsert,
    WorshipTemplate,
    WorshipTemplateUpsert,
)
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


@router.delete("/worship-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_worship_template(
    template_id: str,
    current_user: dict = Depends(require_admin),
    service: WorshipService = Depends(get_worship_service),
) -> None:
    del current_user
    try:
        await service.delete_template(template_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.get("/worship-section-types", response_model=list[WorshipSectionTypeDefinition])
async def list_worship_section_types(
    current_user: dict = Depends(require_admin),
    service: WorshipService = Depends(get_worship_service),
) -> list[WorshipSectionTypeDefinition]:
    del current_user
    return await service.list_section_types()


@router.post("/worship-section-types", response_model=WorshipSectionTypeDefinition)
async def create_worship_section_type(
    payload: WorshipSectionTypeDefinitionUpsert,
    current_user: dict = Depends(require_admin),
    service: WorshipService = Depends(get_worship_service),
) -> WorshipSectionTypeDefinition:
    del current_user
    try:
        return await service.create_section_type(payload)
    except (ConflictError, NotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.put("/worship-section-types/{code}", response_model=WorshipSectionTypeDefinition)
async def update_worship_section_type(
    code: str,
    payload: WorshipSectionTypeDefinitionUpsert,
    current_user: dict = Depends(require_admin),
    service: WorshipService = Depends(get_worship_service),
) -> WorshipSectionTypeDefinition:
    del current_user
    try:
        return await service.update_section_type(code, payload)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.delete("/worship-section-types/{code}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_worship_section_type(
    code: str,
    current_user: dict = Depends(require_admin),
    service: WorshipService = Depends(get_worship_service),
) -> None:
    del current_user
    try:
        await service.delete_section_type(code)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.get("/worship-input-templates", response_model=list[WorshipInputTemplate])
async def list_worship_input_templates(
    current_user: dict = Depends(require_admin),
    service: WorshipService = Depends(get_worship_service),
) -> list[WorshipInputTemplate]:
    del current_user
    return await service.list_input_templates()


@router.post("/worship-input-templates", response_model=WorshipInputTemplate)
async def create_worship_input_template(
    payload: WorshipInputTemplateUpsert,
    current_user: dict = Depends(require_admin),
    service: WorshipService = Depends(get_worship_service),
) -> WorshipInputTemplate:
    del current_user
    try:
        return await service.create_input_template(payload)
    except (ConflictError, NotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.put("/worship-input-templates/{template_id}", response_model=WorshipInputTemplate)
async def update_worship_input_template(
    template_id: str,
    payload: WorshipInputTemplateUpsert,
    current_user: dict = Depends(require_admin),
    service: WorshipService = Depends(get_worship_service),
) -> WorshipInputTemplate:
    del current_user
    try:
        return await service.update_input_template(template_id, payload)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.delete("/worship-input-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_worship_input_template(
    template_id: str,
    current_user: dict = Depends(require_admin),
    service: WorshipService = Depends(get_worship_service),
) -> None:
    del current_user
    try:
        await service.delete_input_template(template_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.get("/worship-slide-templates", response_model=list[WorshipSlideTemplate])
async def list_worship_slide_templates(
    current_user: dict = Depends(require_admin),
    service: WorshipService = Depends(get_worship_service),
) -> list[WorshipSlideTemplate]:
    del current_user
    return await service.list_slide_templates()


@router.post("/worship-slide-templates", response_model=WorshipSlideTemplate)
async def create_worship_slide_template(
    payload: WorshipSlideTemplateUpsert,
    current_user: dict = Depends(require_admin),
    service: WorshipService = Depends(get_worship_service),
) -> WorshipSlideTemplate:
    del current_user
    try:
        return await service.create_slide_template(payload)
    except (ConflictError, NotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.put("/worship-slide-templates/{key}", response_model=WorshipSlideTemplate)
async def update_worship_slide_template(
    key: str,
    payload: WorshipSlideTemplateUpsert,
    current_user: dict = Depends(require_admin),
    service: WorshipService = Depends(get_worship_service),
) -> WorshipSlideTemplate:
    del current_user
    try:
        return await service.update_slide_template(key, payload)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.delete("/worship-slide-templates/{key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_worship_slide_template(
    key: str,
    current_user: dict = Depends(require_admin),
    service: WorshipService = Depends(get_worship_service),
) -> None:
    del current_user
    try:
        await service.delete_slide_template(key)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
