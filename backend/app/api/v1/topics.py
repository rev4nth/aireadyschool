from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import ensure_owner
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.core.security import AuthenticatedUser, get_current_user
from app.models import Document, Subject, Topic, TopicMaterialLink
from app.schemas.topics import (
    TopicMapGenerateRequest,
    TopicMapResponse,
    TopicMaterialResponse,
    TopicResponse,
    TopicUpdate,
)

router = APIRouter()


def _build_tree(topics: list[Topic]) -> list[TopicResponse]:
    by_parent: dict[UUID | None, list[Topic]] = {}
    for topic in topics:
        by_parent.setdefault(topic.parent_id, []).append(topic)

    def serialize(topic: Topic) -> TopicResponse:
        children = [serialize(child) for child in by_parent.get(topic.id, [])]
        return TopicResponse.model_validate(topic).model_copy(update={"children": children})

    return [serialize(t) for t in by_parent.get(None, [])]


@router.get("", response_model=TopicMapResponse)
async def list_topics(
    subject_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TopicMapResponse:
    subject = await db.get(Subject, subject_id)
    if subject is None:
        raise NotFoundError("Subject not found")
    ensure_owner(subject.user_id, user)
    result = await db.execute(
        select(Topic).where(Topic.user_id == user.id, Topic.subject_id == subject_id)
    )
    topics = list(result.scalars().all())
    return TopicMapResponse(subject_id=subject_id, topics=_build_tree(topics))


@router.post("/generate", response_model=TopicMapResponse)
async def generate_topic_map(
    payload: TopicMapGenerateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TopicMapResponse:
    subject = await db.get(Subject, payload.subject_id)
    if subject is None:
        raise NotFoundError("Subject not found")
    ensure_owner(subject.user_id, user)

    from app.services.topics.extractor import extract_topic_map

    topics = await extract_topic_map(db, user.id, payload.subject_id)
    return TopicMapResponse(subject_id=payload.subject_id, topics=_build_tree(topics))


@router.patch("/{topic_id}", response_model=TopicResponse)
async def update_topic(
    topic_id: UUID,
    payload: TopicUpdate,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Topic:
    topic = await db.get(Topic, topic_id)
    if topic is None:
        raise NotFoundError("Topic not found")
    ensure_owner(topic.user_id, user)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(topic, key, value)
    await db.flush()
    await db.refresh(topic)
    return topic


@router.get("/{topic_id}/materials", response_model=TopicMaterialResponse)
async def topic_materials(
    topic_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TopicMaterialResponse:
    topic = await db.get(Topic, topic_id)
    if topic is None:
        raise NotFoundError("Topic not found")
    ensure_owner(topic.user_id, user)

    result = await db.execute(
        select(TopicMaterialLink).where(TopicMaterialLink.topic_id == topic_id)
    )
    links = list(result.scalars().all())
    documents = []
    chunks = []
    for link in links:
        doc = await db.get(Document, link.document_id)
        if doc and doc.user_id == user.id:
            documents.append(
                {
                    "id": str(doc.id),
                    "title": doc.title,
                    "doc_type": doc.doc_type,
                    "relevance_score": link.relevance_score,
                }
            )
        if link.chunk_id:
            chunks.append({"chunk_id": str(link.chunk_id), "document_id": str(link.document_id)})

    return TopicMaterialResponse(topic_id=topic_id, documents=documents, chunks=chunks)
