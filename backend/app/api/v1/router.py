from fastapi import APIRouter

from app.modules.admin.router import router as admin_router
from app.modules.auth.router import router as auth_router
from app.modules.lookups.router import router as lookups_router
from app.modules.udms.router import router as udms_router
from app.modules.users.router import router as users_router

router = APIRouter()
router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(users_router, prefix="/users", tags=["users"])
router.include_router(lookups_router, prefix="/lookups", tags=["lookups"])
router.include_router(udms_router, prefix="/udms", tags=["udms"])
router.include_router(admin_router, prefix="/admin", tags=["admin"])
