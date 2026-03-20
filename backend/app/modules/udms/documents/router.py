from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse

from app.core.store import ConflictError, NotFoundError
from app.dependencies import get_current_user, get_udms_service
from app.modules.udms.schemas import DocumentAttachment, DocumentCreate, DocumentUpdate, UdmsDocumentDetail, UdmsDocumentSummary
from app.modules.udms.service import UdmsService

router = APIRouter()


def _translate_error(error: Exception) -> HTTPException:
    if isinstance(error, NotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))
    if isinstance(error, ConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    raise error


@router.get("/documents", response_model=list[UdmsDocumentSummary])
async def list_documents(
    boardId: str | None = None,
    status_value: str | None = Query(default=None, alias="status"),
    q: str | None = None,
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> list[UdmsDocumentSummary]:
    documents = await service.list_documents(current_user, board_id=boardId, status=status_value, query=q)
    return [UdmsDocumentSummary.model_validate(document) for document in documents]


@router.post("/documents", response_model=UdmsDocumentDetail)
async def create_document(
    payload: DocumentCreate,
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> UdmsDocumentDetail:
    try:
        document = await service.create_document(current_user, payload.model_dump())
        return UdmsDocumentDetail.model_validate(document)
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc


@router.get("/documents/{document_id}", response_model=UdmsDocumentDetail)
async def get_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> UdmsDocumentDetail:
    try:
        document = await service.get_document(current_user, document_id)
        return UdmsDocumentDetail.model_validate(document)
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc


@router.put("/documents/{document_id}", response_model=UdmsDocumentDetail)
async def update_document(
    document_id: str,
    payload: DocumentUpdate,
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> UdmsDocumentDetail:
    try:
        document = await service.update_document(current_user, document_id, payload.model_dump(exclude_unset=True))
        return UdmsDocumentDetail.model_validate(document)
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc


@router.post("/documents/{document_id}/publish", response_model=UdmsDocumentDetail)
async def publish_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> UdmsDocumentDetail:
    try:
        document = await service.publish_document(current_user, document_id)
        return UdmsDocumentDetail.model_validate(document)
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc


@router.post("/documents/{document_id}/versions", response_model=UdmsDocumentDetail)
async def create_next_version(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> UdmsDocumentDetail:
    try:
        document = await service.create_next_version(current_user, document_id)
        return UdmsDocumentDetail.model_validate(document)
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc


@router.get("/documents/{document_id}/versions", response_model=list[UdmsDocumentSummary])
async def list_versions(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> list[UdmsDocumentSummary]:
    try:
        documents = await service.list_versions(current_user, document_id)
        return [UdmsDocumentSummary.model_validate(document) for document in documents]
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc


@router.post("/documents/{document_id}/attachments", response_model=DocumentAttachment)
async def add_attachment(
    document_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> DocumentAttachment:
    try:
        attachment = await service.add_attachment(current_user, document_id, file)
        return DocumentAttachment.model_validate(attachment)
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc


@router.get("/attachments/{attachment_id}/download")
async def download_attachment(
    attachment_id: str,
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> FileResponse:
    try:
        attachment, absolute_path = await service.get_attachment_for_download(current_user, attachment_id)
        return FileResponse(path=absolute_path, filename=attachment["file_name"], media_type=attachment["mime_type"])
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc


@router.delete("/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attachment(
    attachment_id: str,
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> None:
    try:
        await service.delete_attachment(current_user, attachment_id)
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc
