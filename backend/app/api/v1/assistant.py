from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import ensure_owner
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.core.security import AuthenticatedUser, get_current_user
from app.models import ChatSession, Subject
from app.schemas.assistant import ChatRequest, ChatResponse, ChatSessionResponse

router = APIRouter()


@router.get("/sessions", response_model=list[ChatSessionResponse])
async def list_sessions(
    subject_id: UUID | None = None,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ChatSession]:
    query = (
        select(ChatSession)
        .where(ChatSession.user_id == user.id)
        .options(selectinload(ChatSession.messages))
        .order_by(ChatSession.updated_at.desc())
    )
    if subject_id:
        query = query.where(ChatSession.subject_id == subject_id)
    result = await db.execute(query)
    return list(result.scalars().unique().all())


@router.get("/sessions/{session_id}", response_model=ChatSessionResponse)
async def get_session(
    session_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatSession:
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.id == session_id)
        .options(selectinload(ChatSession.messages))
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise NotFoundError("Chat session not found")
    ensure_owner(session.user_id, user)
    return session


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    subject = await db.get(Subject, payload.subject_id)
    if subject is None:
        raise NotFoundError("Subject not found")
    ensure_owner(subject.user_id, user)

    from app.services.rag.pipeline import answer_study_question

    return await answer_study_question(db, user.id, payload)
