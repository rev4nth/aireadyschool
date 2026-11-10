"""Materials upload and processing endpoints."""

from __future__ import annotations

import asyncio
import logging
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import ensure_owner
from app.core.config import Settings, get_settings
from app.core.database import get_db, get_session_factory
from app.core.exceptions import AppError, NotFoundError
from app.core.security import AuthenticatedUser, get_current_user
from app.models import Document, DocumentChunk, Subject
from app.schemas.materials import (
    MaterialCreateText,
    MaterialListResponse,
    MaterialResponse,
    ProcessStatusResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()

ALLOWED_MIME = {
    "application/pdf",
    "text/plain",
}


async def _get_owned_document(db: AsyncSession, doc_id: UUID, user: AuthenticatedUser) -> Document:
    doc = await db.get(Document, doc_id)
    if doc is None:
        raise NotFoundError("Document not found")
    ensure_owner(doc.user_id, user)
    return doc


@router.get("", response_model=MaterialListResponse)
async def list_materials(
    subject_id: UUID | None = None,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MaterialListResponse:
    query = select(Document).where(Document.user_id == user.id)
    if subject_id:
        query = query.where(Document.subject_id == subject_id)
    result = await db.execute(query.order_by(Document.created_at.desc()))
    items = list(result.scalars().all())
    return MaterialListResponse(items=items, total=len(items))


@router.post("/upload", response_model=MaterialResponse, status_code=201)
async def upload_material(
    subject_id: UUID = Form(...),
    doc_type: str = Form("notes"),
    title: str | None = Form(None),
    file: UploadFile = File(...),
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Document:
    subject = await db.get(Subject, subject_id)
    if subject is None:
        raise NotFoundError("Subject not found")
    ensure_owner(subject.user_id, user)

    if file.content_type and file.content_type not in ALLOWED_MIME:
        raise AppError("Unsupported file type. Upload PDF or plain text.", status_code=400)

    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        raise AppError(
            f"File exceeds max size of {settings.max_upload_size_mb}MB",
            status_code=400,
        )

    from app.services.documents.storage import upload_bytes

    doc_id = uuid4()
    file_name = file.filename or "upload.bin"
    storage_path = f"{user.id}/{subject_id}/{doc_id}/{file_name}"
    await upload_bytes(storage_path, content, file.content_type or "application/octet-stream")

    document = Document(
        id=doc_id,
        user_id=user.id,
        subject_id=subject_id,
        title=title or file_name,
        doc_type=doc_type,
        file_name=file_name,
        storage_path=storage_path,
        mime_type=file.content_type,
        file_size_bytes=len(content),
        status="pending",
        metadata_={},
    )
    db.add(document)
    await db.flush()
    await db.refresh(document)

    asyncio.create_task(_process_document_background(document.id))
    return document


@router.post("/text", response_model=MaterialResponse, status_code=201)
async def create_text_material(
    payload: MaterialCreateText,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Document:
    subject = await db.get(Subject, payload.subject_id)
    if subject is None:
        raise NotFoundError("Subject not found")
    ensure_owner(subject.user_id, user)

    from app.services.documents.storage import upload_bytes

    doc_id = uuid4()
    file_name = f"{payload.title}.txt"
    storage_path = f"{user.id}/{payload.subject_id}/{doc_id}/{file_name}"
    data = payload.content.encode("utf-8")
    if len(data) > settings.max_upload_bytes:
        raise AppError("Text content exceeds upload size limit", status_code=400)

    stored_path: str | None = storage_path
    try:
        await upload_bytes(storage_path, data, "text/plain")
    except Exception:  # noqa: BLE001
        logger.warning("text material storage upload failed; continuing with inline content")
        stored_path = None

    document = Document(
        id=doc_id,
        user_id=user.id,
        subject_id=payload.subject_id,
        title=payload.title,
        doc_type=payload.doc_type,
        file_name=file_name,
        storage_path=stored_path,
        mime_type="text/plain",
        file_size_bytes=len(data),
        status="pending",
        # Keep inline copy so processing still works if Storage download fails.
        metadata_={"inline_text": True, "text_content": payload.content},
    )
    db.add(document)
    await db.flush()
    await db.refresh(document)
    asyncio.create_task(_process_document_background(document.id))
    return document


@router.get("/{material_id}", response_model=MaterialResponse)
async def get_material(
    material_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Document:
    return await _get_owned_document(db, material_id, user)


@router.post("/{material_id}/process", response_model=ProcessStatusResponse)
async def process_material(
    material_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProcessStatusResponse:
    doc = await _get_owned_document(db, material_id, user)
    doc.status = "pending"
    doc.error_message = None
    await db.flush()
    asyncio.create_task(_process_document_background(doc.id))
    return ProcessStatusResponse(id=doc.id, status=doc.status, error_message=None)


@router.get("/{material_id}/status", response_model=ProcessStatusResponse)
async def material_status(
    material_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProcessStatusResponse:
    doc = await _get_owned_document(db, material_id, user)
    chunk_count = await db.scalar(
        select(func.count()).select_from(DocumentChunk).where(DocumentChunk.document_id == doc.id)
    )
    return ProcessStatusResponse(
        id=doc.id,
        status=doc.status,
        error_message=doc.error_message,
        page_count=doc.page_count,
        chunk_count=chunk_count or 0,
    )


@router.delete("/{material_id}", status_code=204, response_class=Response)
async def delete_material(
    material_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    doc = await _get_owned_document(db, material_id, user)
    from app.services.cache.service import invalidate_user_material_caches
    from app.services.documents.storage import delete_object

    if doc.storage_path:
        await delete_object(doc.storage_path)
    await invalidate_user_material_caches(str(user.id))
    await db.delete(doc)
    return Response(status_code=204)


async def _process_document_background(document_id: UUID) -> None:
    try:
        from app.services.documents.processor import process_document

        session_factory = get_session_factory()
        async with session_factory() as session:
            await process_document(session, document_id)
            await session.commit()
    except Exception:  # noqa: BLE001
        logger.exception("Background document processing failed for %s", document_id)
