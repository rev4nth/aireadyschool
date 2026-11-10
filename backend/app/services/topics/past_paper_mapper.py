"""Map past-paper material to topics and update exam frequency counts."""

from __future__ import annotations

import logging
import re
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Document, DocumentChunk, Topic

logger = logging.getLogger(__name__)

_TOKEN_RE = re.compile(r"[a-z0-9]{3,}", re.I)


def _topic_tokens(name: str) -> list[str]:
    stop = {"the", "and", "for", "with", "from", "unit", "chapter", "section"}
    tokens = [t.lower() for t in _TOKEN_RE.findall(name or "")]
    return [t for t in tokens if t not in stop][:6]


async def update_past_paper_frequencies(
    db: AsyncSession,
    *,
    user_id: UUID,
    subject_id: UUID,
) -> dict[str, int]:
    """Count past-paper chunk hits per topic and persist past_paper_frequency."""
    topics = list(
        (
            await db.execute(
                select(Topic).where(Topic.user_id == user_id, Topic.subject_id == subject_id)
            )
        )
        .scalars()
        .all()
    )
    if not topics:
        return {}

    past_docs = list(
        (
            await db.execute(
                select(Document.id).where(
                    Document.user_id == user_id,
                    Document.subject_id == subject_id,
                    Document.status == "processed",
                    Document.doc_type.in_(["past_paper", "past_papers"]),
                )
            )
        )
        .scalars()
        .all()
    )
    if not past_docs:
        # Soft fallback: any processed material containing "past paper" in title
        past_docs = list(
            (
                await db.execute(
                    select(Document.id).where(
                        Document.user_id == user_id,
                        Document.subject_id == subject_id,
                        Document.status == "processed",
                        Document.title.ilike("%past%"),
                    )
                )
            )
            .scalars()
            .all()
        )
    if not past_docs:
        logger.info("past_paper.mapper skip subject=%s reason=no_past_papers", subject_id)
        return {}

    chunk_rows = list(
        (
            await db.execute(
                select(DocumentChunk.content).where(
                    DocumentChunk.user_id == user_id,
                    DocumentChunk.subject_id == subject_id,
                    DocumentChunk.document_id.in_(past_docs),
                )
            )
        )
        .scalars()
        .all()
    )
    if not chunk_rows:
        return {}

    corpus = "\n".join(c or "" for c in chunk_rows).lower()
    frequencies: dict[str, int] = {}
    for topic in topics:
        tokens = _topic_tokens(topic.name)
        if not tokens:
            topic.past_paper_frequency = 0
            frequencies[str(topic.id)] = 0
            continue

        # Prefer full-name hits; otherwise require at least two token hits.
        full = topic.name.lower().strip()
        if len(full) >= 4 and full in corpus:
            count = corpus.count(full)
        else:
            count = sum(1 for token in tokens if token in corpus)
            if count < 2:
                count = 1 if any(token in corpus for token in tokens) else 0

        # Cap and also nudge exam importance when frequency is high.
        topic.past_paper_frequency = int(min(count, 50))
        if topic.past_paper_frequency >= 3:
            topic.exam_importance = max(float(topic.exam_importance or 0), 75.0)
        elif topic.past_paper_frequency >= 1:
            topic.exam_importance = max(float(topic.exam_importance or 0), 60.0)
        frequencies[str(topic.id)] = topic.past_paper_frequency

    await db.flush()
    logger.info(
        "past_paper.mapper subject=%s topics=%s docs=%s",
        subject_id,
        len(frequencies),
        len(past_docs),
    )
    return frequencies
