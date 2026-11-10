"""Document processing pipeline: extract → chunk → embed → store."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError, NotFoundError
from app.models import Document, DocumentChunk
from app.services.ai.embeddings import get_embedding_service
from app.services.cache.service import invalidate_user_material_caches
from app.services.documents.extraction import extract_pdf_bytes, extract_plain_text
from app.services.documents.storage import download_bytes
from app.services.rag.chunking import chunk_pages

logger = logging.getLogger(__name__)


async def process_document(session: AsyncSession, document_id: UUID) -> Document:
    result = await session.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    if document is None:
        raise NotFoundError("Document not found")

    document.status = "processing"
    document.error_message = None
    await session.flush()

    try:
        if not document.storage_path:
            raise AppError("Document has no storage path", status_code=400, code="missing_source")

        data = await download_bytes(document.storage_path)
        mime = (document.mime_type or "").lower()
        name = (document.file_name or document.title or "").lower()

        if "pdf" in mime or name.endswith(".pdf"):
            extracted = extract_pdf_bytes(data, filename=document.file_name or document.title)
        else:
            try:
                text = data.decode("utf-8")
            except UnicodeDecodeError as exc:
                raise AppError(
                    "Unsupported file encoding. Upload a PDF or UTF-8 text file.",
                    status_code=400,
                    code="unsupported_encoding",
                ) from exc
            extracted = extract_plain_text(text, title=document.title)

        chunks = chunk_pages(extracted.pages)
        if not chunks:
            raise AppError("No usable text chunks after extraction", status_code=422, code="empty_chunks")

        vectors = await get_embedding_service().embed_texts([c.content for c in chunks])
        await session.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document.id))
        await session.flush()

        for chunk, vector in zip(chunks, vectors, strict=True):
            session.add(
                DocumentChunk(
                    document_id=document.id,
                    user_id=document.user_id,
                    subject_id=document.subject_id,
                    chunk_index=chunk.chunk_index,
                    page_number=chunk.page_number,
                    section_heading=chunk.section_heading,
                    content=chunk.content,
                    token_count=chunk.token_count,
                    embedding=vector,
                    metadata_={},
                )
            )

        document.status = "processed"
        document.error_message = None
        document.page_count = extracted.page_count
        document.material_version = int(document.material_version or 1) + 1
        await session.flush()
        await invalidate_user_material_caches(str(document.user_id))
        logger.info(
            "document.processed id=%s chunks=%s version=%s",
            document.id,
            len(chunks),
            document.material_version,
        )
        return document
    except AppError as exc:
        document.status = "failed"
        document.error_message = exc.message
        await session.flush()
        raise
    except Exception as exc:  # noqa: BLE001
        document.status = "failed"
        document.error_message = "Document processing failed unexpectedly"
        await session.flush()
        logger.exception("document.process_failed id=%s", document_id)
        raise AppError("Document processing failed", status_code=500, code="processing_failed") from exc


class DocumentProcessor:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def process_document(self, document_id: UUID, *, user_id: UUID | None = None) -> Document:
        doc = await process_document(self.session, document_id)
        if user_id is not None and doc.user_id != user_id:
            raise NotFoundError("Document not found")
        return doc
