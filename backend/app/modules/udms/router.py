from fastapi import APIRouter, Depends

from app.dependencies import get_current_user, get_udms_service
from app.modules.udms.approvals.router import router as approvals_router
from app.modules.udms.boards.router import router as boards_router
from app.modules.udms.documents.router import router as documents_router
from app.modules.udms.hooks.router import router as hooks_router
from app.modules.udms.permissions.router import router as document_permissions_router
from app.modules.udms.schemas import TargetTypeCatalogEntry
from app.modules.udms.shares.router import router as shares_router
from app.modules.udms.service import UdmsService

router = APIRouter()


@router.get("/target-types", response_model=list[TargetTypeCatalogEntry], tags=["udms:target-types"])
async def list_target_types(
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> list[TargetTypeCatalogEntry]:
    del current_user
    targets = await service.list_target_types()
    return [TargetTypeCatalogEntry.model_validate(item) for item in targets]


router.include_router(boards_router, tags=["udms:boards"])
router.include_router(documents_router, tags=["udms:docs"])
router.include_router(shares_router, tags=["udms:shared"])
router.include_router(approvals_router, tags=["udms:approvals"])
router.include_router(document_permissions_router, tags=["udms:policies"])
router.include_router(hooks_router, tags=["udms:hooks"])
