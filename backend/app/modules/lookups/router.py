from fastapi import APIRouter, Depends

from app.dependencies import get_app_store

router = APIRouter()


@router.get("/departments")
async def list_departments(store=Depends(get_app_store)) -> list[dict]:
    return store.lookups["departments"]


@router.get("/positions")
async def list_positions(store=Depends(get_app_store)) -> list[dict]:
    return store.lookups["positions"]
