from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.store import ConflictError, NotFoundError
from app.dependencies import get_current_user, get_worship_service
from app.modules.worship.schemas import (
    ScriptureLookupQuery,
    WorshipCalendarResponse,
    WorshipGuestInputPayload,
    WorshipGuestLinkResponse,
    WorshipGuestTaskView,
    WorshipLyricsParseRequest,
    WorshipLyricsParseResponse,
    WorshipPresentationActivateRequest,
    WorshipPresentationState,
    WorshipReviewResponse,
    WorshipScriptureLookupResponse,
    WorshipSectionReorderRequest,
    WorshipSectionUpdate,
    WorshipServiceDetail,
    WorshipServiceUpdate,
    WorshipSongLookupItem,
)
from app.services.worship_service import WorshipService

router = APIRouter()


def _raise_http_error(error: Exception) -> None:
    if isinstance(error, NotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    if isinstance(error, ConflictError):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    raise error


@router.get("/calendar", response_model=WorshipCalendarResponse)
async def get_calendar(
    anchor_date: str | None = Query(default=None, alias="anchorDate"),
    days: int = Query(default=12, ge=1, le=42),
    current_user: dict = Depends(get_current_user),
    service: WorshipService = Depends(get_worship_service),
) -> WorshipCalendarResponse:
    del current_user
    try:
        return await service.list_calendar(anchor_date=anchor_date, days=days)
    except Exception as error:
        _raise_http_error(error)


@router.get("/services/{service_id}", response_model=WorshipServiceDetail)
async def get_service(
    service_id: str,
    current_user: dict = Depends(get_current_user),
    service: WorshipService = Depends(get_worship_service),
) -> WorshipServiceDetail:
    del current_user
    try:
        return await service.get_service(service_id)
    except Exception as error:
        _raise_http_error(error)


@router.patch("/services/{service_id}", response_model=WorshipServiceDetail)
async def update_service(
    service_id: str,
    payload: WorshipServiceUpdate,
    current_user: dict = Depends(get_current_user),
    service: WorshipService = Depends(get_worship_service),
) -> WorshipServiceDetail:
    try:
        return await service.update_service(current_user, service_id, payload.model_dump(exclude_none=True))
    except Exception as error:
        _raise_http_error(error)


@router.patch("/services/{service_id}/sections/{section_id}", response_model=WorshipServiceDetail)
async def update_section(
    service_id: str,
    section_id: str,
    payload: WorshipSectionUpdate,
    current_user: dict = Depends(get_current_user),
    service: WorshipService = Depends(get_worship_service),
) -> WorshipServiceDetail:
    try:
        return await service.update_section(current_user, service_id, section_id, payload.model_dump(exclude_none=True))
    except Exception as error:
        _raise_http_error(error)


@router.post("/services/{service_id}/sections/reorder", response_model=WorshipServiceDetail)
async def reorder_sections(
    service_id: str,
    payload: WorshipSectionReorderRequest,
    current_user: dict = Depends(get_current_user),
    service: WorshipService = Depends(get_worship_service),
) -> WorshipServiceDetail:
    try:
        return await service.reorder_sections(current_user, service_id, payload.model_dump())
    except Exception as error:
        _raise_http_error(error)


@router.post("/services/{service_id}/tasks/{task_id}/guest-link", response_model=WorshipGuestLinkResponse)
async def issue_guest_link(
    service_id: str,
    task_id: str,
    current_user: dict = Depends(get_current_user),
    service: WorshipService = Depends(get_worship_service),
) -> WorshipGuestLinkResponse:
    try:
        return await service.issue_guest_link(current_user, service_id, task_id)
    except Exception as error:
        _raise_http_error(error)


@router.get("/input/{token}", response_model=WorshipGuestTaskView)
async def get_guest_input(
    token: str,
    service: WorshipService = Depends(get_worship_service),
) -> WorshipGuestTaskView:
    try:
        return await service.get_guest_input(token)
    except Exception as error:
        _raise_http_error(error)


@router.put("/input/{token}", response_model=WorshipGuestTaskView)
async def submit_guest_input(
    token: str,
    payload: WorshipGuestInputPayload,
    service: WorshipService = Depends(get_worship_service),
) -> WorshipGuestTaskView:
    try:
        return await service.submit_guest_input(token, payload)
    except Exception as error:
        _raise_http_error(error)


@router.get("/lookups/songs", response_model=list[WorshipSongLookupItem])
async def lookup_songs(
    q: str = Query(default="", alias="q"),
    current_user: dict = Depends(get_current_user),
    service: WorshipService = Depends(get_worship_service),
) -> list[WorshipSongLookupItem]:
    del current_user
    try:
        return await service.search_songs(q)
    except Exception as error:
        _raise_http_error(error)


@router.get("/lookups/scripture", response_model=WorshipScriptureLookupResponse)
async def lookup_scripture(
    query: ScriptureLookupQuery = Depends(),
    current_user: dict = Depends(get_current_user),
    service: WorshipService = Depends(get_worship_service),
) -> WorshipScriptureLookupResponse:
    del current_user
    try:
        return await service.lookup_scripture(
            book=query.book,
            chapter=query.chapter,
            verse_start=query.verse_start,
            verse_end=query.verse_end,
            translation=query.translation,
        )
    except Exception as error:
        _raise_http_error(error)


@router.post("/services/{service_id}/sections/{section_id}/lyrics:parse", response_model=WorshipLyricsParseResponse)
async def parse_lyrics(
    service_id: str,
    section_id: str,
    payload: WorshipLyricsParseRequest,
    current_user: dict = Depends(get_current_user),
    service: WorshipService = Depends(get_worship_service),
) -> WorshipLyricsParseResponse:
    try:
        return await service.parse_lyrics_for_section(
            current_user,
            service_id,
            section_id,
            payload.lyrics,
            payload.template_key or "lyrics-16x9",
        )
    except Exception as error:
        _raise_http_error(error)


@router.get("/services/{service_id}/review", response_model=WorshipReviewResponse)
async def get_review(
    service_id: str,
    current_user: dict = Depends(get_current_user),
    service: WorshipService = Depends(get_worship_service),
) -> WorshipReviewResponse:
    try:
        return await service.get_review(current_user, service_id)
    except Exception as error:
        _raise_http_error(error)


@router.post("/services/{service_id}/presentation/activate", response_model=WorshipPresentationState)
async def activate_presentation(
    service_id: str,
    payload: WorshipPresentationActivateRequest,
    current_user: dict = Depends(get_current_user),
    service: WorshipService = Depends(get_worship_service),
) -> WorshipPresentationState:
    try:
        return await service.activate_presentation(current_user, service_id, payload.selected_section_ids)
    except Exception as error:
        _raise_http_error(error)
