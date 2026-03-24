from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse

from app.core.store import ConflictError, NotFoundError
from app.dependencies import get_current_user, get_udms_service
from app.modules.udms.schemas import (
    DocumentAttachment,
    DocumentCreate,
    DocumentDetail,
    DocumentRevision,
    DocumentRollbackRequest,
    DocumentSecurityUpdate,
    DocumentSummary,
    DocumentUpdate,
    ExternalShareCreate,
)
from app.modules.udms.service import UdmsService

router = APIRouter()


def _translate_error(error: Exception) -> HTTPException:
    if isinstance(error, NotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))
    if isinstance(error, ConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    raise error


@router.get("/docs", response_model=list[DocumentSummary])
async def list_documents(
    targetType: str | None = None,
    targetId: str | None = None,
    status_value: str | None = Query(default=None, alias="status"),
    q: str | None = None,
    myDocuments: bool = False,
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> list[DocumentSummary]:
    author_id = current_user["id"] if myDocuments else None
    documents = await service.list_documents(
        current_user,
        target_type=targetType,
        target_id=targetId,
        status=status_value,
        query=q,
        author_id=author_id,
    )
    return [DocumentSummary.model_validate(document) for document in documents]


@router.post("/docs", response_model=DocumentDetail)
async def create_document(
    payload: DocumentCreate,
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> DocumentDetail:
    try:
        document = await service.create_document(current_user, payload.model_dump(mode="json"))
        return DocumentDetail.model_validate(document)
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc


@router.get("/docs/{document_id}", response_model=DocumentDetail)
async def get_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> DocumentDetail:
    try:
        document = await service.get_document(current_user, document_id)
        return DocumentDetail.model_validate(document)
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc


@router.patch("/docs/{document_id}", response_model=DocumentDetail)
async def update_document(
    document_id: str,
    payload: DocumentUpdate,
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> DocumentDetail:
    try:
        document = await service.update_working_copy(current_user, document_id, payload.model_dump(mode="json", exclude_unset=True))
        return DocumentDetail.model_validate(document)
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc


@router.post("/docs/{document_id}/working-copy", response_model=DocumentDetail)
async def create_working_copy(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> DocumentDetail:
    try:
        document = await service.create_working_copy(current_user, document_id)
        return DocumentDetail.model_validate(document)
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc


@router.post("/docs/{document_id}/publish", response_model=DocumentDetail)
async def publish_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> DocumentDetail:
    try:
        document = await service.publish_document(current_user, document_id)
        return DocumentDetail.model_validate(document)
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc


@router.post("/docs/{document_id}/rollback", response_model=DocumentDetail)
async def rollback_document(
    document_id: str,
    payload: DocumentRollbackRequest,
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> DocumentDetail:
    try:
        document = await service.rollback_document(current_user, document_id, payload.target_version)
        return DocumentDetail.model_validate(document)
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc


@router.get("/docs/{document_id}/revisions", response_model=list[DocumentRevision])
async def list_revisions(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> list[DocumentRevision]:
    try:
        revisions = await service.list_revisions(current_user, document_id)
        return [DocumentRevision.model_validate(revision) for revision in revisions]
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc


@router.put("/docs/{document_id}/security", response_model=DocumentDetail)
async def replace_document_security(
    document_id: str,
    payload: DocumentSecurityUpdate,
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> DocumentDetail:
    try:
        document = await service.replace_document_security(current_user, document_id, payload.model_dump(mode="json"))
        return DocumentDetail.model_validate(document)
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc


@router.post("/docs/{document_id}/external-shares", response_model=DocumentDetail)
async def create_external_share(
    document_id: str,
    payload: ExternalShareCreate,
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> DocumentDetail:
    try:
        document = await service.create_external_share(current_user, document_id, payload.model_dump(mode="json"))
        return DocumentDetail.model_validate(document)
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc


@router.delete("/docs/{document_id}/external-shares/{share_id}", response_model=DocumentDetail)
async def delete_external_share(
    document_id: str,
    share_id: str,
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> DocumentDetail:
    try:
        document = await service.delete_external_share(current_user, document_id, share_id)
        return DocumentDetail.model_validate(document)
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc


@router.post("/docs/{document_id}/files", response_model=DocumentAttachment)
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


@router.get("/files/{attachment_id}/download")
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


@router.delete("/files/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attachment(
    attachment_id: str,
    current_user: dict = Depends(get_current_user),
    service: UdmsService = Depends(get_udms_service),
) -> None:
    try:
        await service.delete_attachment(current_user, attachment_id)
    except (NotFoundError, ConflictError) as exc:
        raise _translate_error(exc) from exc
