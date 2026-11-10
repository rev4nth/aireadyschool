"""Hybrid retrieval: pgvector cosine + keyword ILIKE."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import Select, and_, func, literal, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import AppError
from app.models import Document, DocumentChunk
from app.services.ai.embeddings import get_embedding_service
from app.utils.text import content_fingerprint

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RetrievedChunk:
    chunk_id: UUID
    document_title: str
    page_number: int | None
    section_heading: str | None
    content: str
    score: float
    document_id: UUID | None = None
    subject_id: UUID | None = None


def retrieval_fingerprint(query: str) -> str:
    return content_fingerprint(query.strip().lower())


async def material_version_for_subject(
    db: AsyncSession, user_id: UUID, subject_id: UUID
) -> int:
    result = await db.execute(
        select(func.coalesce(func.max(Document.material_version), 0)).where(
            Document.user_id == user_id,
            Document.subject_id == subject_id,
            Document.status == "processed",
        )
    )
    return int(result.scalar_one() or 0)


async def hybrid_retrieve(
    db: AsyncSession,
    *,
    user_id: UUID,
    query: str,
    subject_id: UUID | None = None,
    document_ids: list[UUID] | None = None,
    top_k: int | None = None,
    vector_weight: float = 0.7,
    keyword_weight: float = 0.3,
) -> list[RetrievedChunk]:
    retriever = HybridRetriever(db)
    return await retriever.retrieve(
        user_id=user_id,
        query=query,
        subject_id=subject_id,
        document_ids=document_ids,
        top_k=top_k,
        vector_weight=vector_weight,
        keyword_weight=keyword_weight,
    )


class HybridRetriever:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.settings = get_settings()
        self.embeddings = get_embedding_service()

    async def retrieve(
        self,
        *,
        user_id: UUID,
        query: str,
        subject_id: UUID | None = None,
        document_ids: list[UUID] | None = None,
        top_k: int | None = None,
        vector_weight: float = 0.7,
        keyword_weight: float = 0.3,
    ) -> list[RetrievedChunk]:
        if user_id is None:
            raise AppError("user_id is required for retrieval", status_code=400, code="invalid_input")
        if not query or not query.strip():
            raise AppError("Retrieval query must not be empty", status_code=400, code="invalid_input")

        k = top_k or self.settings.retrieval_top_k
        query_embedding = await self.embeddings.embed_query(query.strip())

        vector_rows = await self._vector_search(
            user_id=user_id,
            query_embedding=query_embedding,
            subject_id=subject_id,
            document_ids=document_ids,
            limit=max(k * 3, 20),
        )
        keyword_rows = await self._keyword_search(
            user_id=user_id,
            query=query.strip(),
            subject_id=subject_id,
            document_ids=document_ids,
            limit=max(k * 3, 20),
        )
        merged = self._merge_scores(
            vector_rows, keyword_rows, vector_weight=vector_weight, keyword_weight=keyword_weight
        )
        ranked = sorted(merged.values(), key=lambda c: c.score, reverse=True)[:k]
        logger.info(
            "retrieval.complete user=%s subject=%s hits=%s",
            user_id,
            subject_id,
            len(ranked),
        )
        return ranked

    def _base_filters(
        self,
        *,
        user_id: UUID,
        subject_id: UUID | None,
        document_ids: list[UUID] | None,
    ) -> list:
        filters = [DocumentChunk.user_id == user_id]
        if subject_id is not None:
            filters.append(DocumentChunk.subject_id == subject_id)
        if document_ids:
            filters.append(DocumentChunk.document_id.in_(document_ids))
        return filters

    async def _vector_search(
        self,
        *,
        user_id: UUID,
        query_embedding: list[float],
        subject_id: UUID | None,
        document_ids: list[UUID] | None,
        limit: int,
    ) -> list[RetrievedChunk]:
        distance = DocumentChunk.embedding.cosine_distance(query_embedding)
        similarity = (literal(1.0) - distance).label("similarity")
        stmt: Select = (
            select(
                DocumentChunk.id,
                DocumentChunk.document_id,
                DocumentChunk.subject_id,
                DocumentChunk.page_number,
                DocumentChunk.section_heading,
                DocumentChunk.content,
                Document.title,
                similarity,
            )
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(
                and_(
                    *self._base_filters(
                        user_id=user_id, subject_id=subject_id, document_ids=document_ids
                    ),
                    DocumentChunk.embedding.is_not(None),
                )
            )
            .order_by(distance.asc())
            .limit(limit)
        )
        rows = (await self.session.execute(stmt)).all()
        return [
            RetrievedChunk(
                chunk_id=row.id,
                document_id=row.document_id,
                subject_id=row.subject_id,
                document_title=row.title or "Untitled",
                page_number=row.page_number,
                section_heading=row.section_heading,
                content=row.content,
                score=float(row.similarity or 0.0),
            )
            for row in rows
        ]

    async def _keyword_search(
        self,
        *,
        user_id: UUID,
        query: str,
        subject_id: UUID | None,
        document_ids: list[UUID] | None,
        limit: int,
    ) -> list[RetrievedChunk]:
        tokens = [t for t in query.split() if len(t) > 2][:8] or [query[:64]]
        like_clauses = [DocumentChunk.content.ilike(f"%{token}%") for token in tokens]
        stmt: Select = (
            select(
                DocumentChunk.id,
                DocumentChunk.document_id,
                DocumentChunk.subject_id,
                DocumentChunk.page_number,
                DocumentChunk.section_heading,
                DocumentChunk.content,
                Document.title,
            )
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(
                and_(
                    *self._base_filters(
                        user_id=user_id, subject_id=subject_id, document_ids=document_ids
                    ),
                    or_(*like_clauses),
                )
            )
            .limit(limit)
        )
        rows = (await self.session.execute(stmt)).all()
        lower_tokens = [t.lower() for t in tokens]
        scored: list[RetrievedChunk] = []
        for row in rows:
            content_l = (row.content or "").lower()
            hits = sum(1 for t in lower_tokens if t in content_l)
            scored.append(
                RetrievedChunk(
                    chunk_id=row.id,
                    document_id=row.document_id,
                    subject_id=row.subject_id,
                    document_title=row.title or "Untitled",
                    page_number=row.page_number,
                    section_heading=row.section_heading,
                    content=row.content,
                    score=hits / max(len(lower_tokens), 1),
                )
            )
        return scored

    def _merge_scores(
        self,
        vector_rows: list[RetrievedChunk],
        keyword_rows: list[RetrievedChunk],
        *,
        vector_weight: float,
        keyword_weight: float,
    ) -> dict[UUID, RetrievedChunk]:
        merged: dict[UUID, RetrievedChunk] = {}

        def upsert(row: RetrievedChunk, weight: float) -> None:
            existing = merged.get(row.chunk_id)
            weighted = row.score * weight
            if existing:
                merged[row.chunk_id] = RetrievedChunk(
                    chunk_id=existing.chunk_id,
                    document_id=existing.document_id,
                    subject_id=existing.subject_id,
                    document_title=existing.document_title,
                    page_number=existing.page_number,
                    section_heading=existing.section_heading,
                    content=existing.content,
                    score=existing.score + weighted,
                )
            else:
                merged[row.chunk_id] = RetrievedChunk(
                    chunk_id=row.chunk_id,
                    document_id=row.document_id,
                    subject_id=row.subject_id,
                    document_title=row.document_title,
                    page_number=row.page_number,
                    section_heading=row.section_heading,
                    content=row.content,
                    score=weighted,
                )

        for row in vector_rows:
            upsert(row, vector_weight)
        for row in keyword_rows:
            upsert(row, keyword_weight)
        return merged
