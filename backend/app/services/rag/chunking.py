"""Text chunking that preserves page and section boundaries."""

from __future__ import annotations

from dataclasses import dataclass

from app.core.config import get_settings
from app.utils.text import estimate_token_count, sanitize_text


@dataclass(frozen=True)
class TextChunk:
    content: str
    page_number: int | None = None
    section_heading: str | None = None
    chunk_index: int = 0
    token_count: int = 0


@dataclass(frozen=True)
class PageSection:
    text: str
    page_number: int | None = None
    section_heading: str | None = None


def chunk_text(
    text: str,
    *,
    page_number: int | None = None,
    section_heading: str | None = None,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
    start_index: int = 0,
) -> list[TextChunk]:
    settings = get_settings()
    size = chunk_size if chunk_size is not None else settings.chunk_size
    overlap = chunk_overlap if chunk_overlap is not None else settings.chunk_overlap
    if size <= 0:
        raise ValueError("chunk_size must be positive")
    if overlap < 0 or overlap >= size:
        raise ValueError("chunk_overlap must be >= 0 and < chunk_size")

    cleaned = sanitize_text(text)
    if not cleaned:
        return []

    chunks: list[TextChunk] = []
    start = 0
    index = start_index
    length = len(cleaned)

    while start < length:
        end = min(start + size, length)
        if end < length:
            break_at = cleaned.rfind(" ", start, end)
            if break_at > start + size // 2:
                end = break_at
        piece = cleaned[start:end].strip()
        if piece:
            chunks.append(
                TextChunk(
                    content=piece,
                    page_number=page_number,
                    section_heading=section_heading,
                    chunk_index=index,
                    token_count=estimate_token_count(piece),
                )
            )
            index += 1
        if end >= length:
            break
        start = max(0, end - overlap)
    return chunks


def chunk_pages(
    pages: list[PageSection],
    *,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> list[TextChunk]:
    all_chunks: list[TextChunk] = []
    next_index = 0
    for page in pages:
        parts = chunk_text(
            page.text,
            page_number=page.page_number,
            section_heading=page.section_heading,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            start_index=next_index,
        )
        all_chunks.extend(parts)
        if all_chunks:
            next_index = all_chunks[-1].chunk_index + 1
    return all_chunks
