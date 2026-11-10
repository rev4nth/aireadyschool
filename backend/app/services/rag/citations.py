"""Citation validation — never invent sources outside retrieved chunks."""

from __future__ import annotations

from typing import Any, Iterable
from uuid import UUID

from app.schemas.common import CitationSchema
from app.services.rag.retrieval import RetrievedChunk


def allowed_chunk_ids(chunks: Iterable[RetrievedChunk]) -> set[UUID]:
    return {c.chunk_id for c in chunks}


def build_citation_index(chunks: Iterable[RetrievedChunk]) -> dict[UUID, RetrievedChunk]:
    return {c.chunk_id: c for c in chunks}


def build_citations(
    chunks: Iterable[RetrievedChunk],
    *,
    limit: int = 8,
    max_excerpt: int = 280,
) -> list[CitationSchema]:
    out: list[CitationSchema] = []
    for chunk in list(chunks)[:limit]:
        out.append(
            CitationSchema(
                chunk_id=chunk.chunk_id,
                document_title=chunk.document_title,
                page_number=chunk.page_number,
                section_heading=chunk.section_heading,
                excerpt=(chunk.content or "")[:max_excerpt],
                score=chunk.score,
            )
        )
    return out


def citations_as_dicts(citations: Iterable[CitationSchema | dict[str, Any]]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for item in citations:
        if isinstance(item, CitationSchema):
            result.append(item.model_dump(mode="json"))
        else:
            result.append(dict(item))
    return result


def validate_citation_ids(
    citation_ids: Iterable[Any],
    retrieved: Iterable[RetrievedChunk],
    *,
    max_excerpt: int = 280,
) -> list[CitationSchema]:
    index = build_citation_index(retrieved)
    allowed = set(index.keys())
    validated: list[CitationSchema] = []
    seen: set[UUID] = set()
    for raw in citation_ids or []:
        try:
            chunk_id = UUID(str(raw))
        except (TypeError, ValueError):
            continue
        if chunk_id not in allowed or chunk_id in seen:
            continue
        seen.add(chunk_id)
        source = index[chunk_id]
        validated.append(
            CitationSchema(
                chunk_id=chunk_id,
                document_title=source.document_title,
                page_number=source.page_number,
                section_heading=source.section_heading,
                excerpt=(source.content or "")[:max_excerpt],
                score=source.score,
            )
        )
    return validated


def validate_citations(
    citations: list[Any],
    retrieved: Iterable[RetrievedChunk],
    *,
    max_excerpt: int = 280,
) -> list[CitationSchema]:
    index = build_citation_index(retrieved)
    allowed = set(index.keys())
    validated: list[CitationSchema] = []
    seen: set[UUID] = set()

    for item in citations or []:
        raw = None
        if isinstance(item, CitationSchema):
            raw = item.chunk_id
        elif isinstance(item, dict):
            raw = item.get("chunk_id") or item.get("id")
        else:
            raw = item
        try:
            chunk_id = UUID(str(raw))
        except (TypeError, ValueError):
            continue
        if chunk_id not in allowed or chunk_id in seen:
            continue
        seen.add(chunk_id)
        source = index[chunk_id]
        excerpt = None
        if isinstance(item, dict):
            excerpt = item.get("excerpt")
        if not excerpt:
            excerpt = (source.content or "")[:max_excerpt]
        validated.append(
            CitationSchema(
                chunk_id=chunk_id,
                document_title=source.document_title,
                page_number=source.page_number,
                section_heading=source.section_heading,
                excerpt=excerpt,
                score=source.score,
            )
        )
    return validated


def filter_chunk_id_list(
    chunk_ids: Iterable[Any],
    retrieved: Iterable[RetrievedChunk],
) -> list[UUID]:
    allowed = allowed_chunk_ids(retrieved)
    result: list[UUID] = []
    for raw in chunk_ids or []:
        try:
            cid = UUID(str(raw))
        except (TypeError, ValueError):
            continue
        if cid in allowed and cid not in result:
            result.append(cid)
    return result
