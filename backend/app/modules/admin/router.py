from fastapi import APIRouter

from app.modules.admin.boards.router import router as boards_router
from app.modules.admin.permissions.router import router as permissions_router
from app.modules.admin.users.router import router as users_router
from app.modules.admin.worship_templates.router import router as worship_templates_router

router = APIRouter()
router.include_router(users_router, tags=["admin:users"])
router.include_router(boards_router, tags=["admin:boards"])
router.include_router(worship_templates_router, tags=["admin:worship-templates"])
router.include_router(permissions_router, tags=["admin:permissions"])
