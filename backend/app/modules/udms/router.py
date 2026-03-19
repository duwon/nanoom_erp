from fastapi import APIRouter

from app.modules.udms.approvals.router import router as approvals_router
from app.modules.udms.boards.router import router as boards_router
from app.modules.udms.documents.router import router as documents_router
from app.modules.udms.permissions.router import router as document_permissions_router
from app.modules.udms.shares.router import router as shares_router

router = APIRouter()
router.include_router(boards_router, tags=["udms:boards"])
router.include_router(documents_router, tags=["udms:documents"])
router.include_router(shares_router, tags=["udms:shares"])
router.include_router(approvals_router, tags=["udms:approvals"])
router.include_router(document_permissions_router, tags=["udms:permissions"])
