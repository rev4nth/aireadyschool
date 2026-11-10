"""Study assistant / chat schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel

ChatMode = Literal["explain", "examples", "summarize", "practice"]


class ChatRequest(BaseModel):
    subject_id: UUID
    message: str = Field(min_length=1, max_length=8000)
    session_id: UUID | None = None
    topic_id: UUID | None = None
    mode: ChatMode = "explain"


class ChatMessageResponse(ORMModel):
    id: UUID
    session_id: UUID
    user_id: UUID
    role: str
    content: str
    citations: list[Any] = Field(default_factory=list)
    insufficient_context: bool = False
    created_at: datetime | None = None


class ChatSessionResponse(ORMModel):
    id: UUID
    user_id: UUID
    subject_id: UUID | None = None
    topic_id: UUID | None = None
    title: str | None = None
    messages: list[ChatMessageResponse] = Field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ChatResponse(BaseModel):
    session: ChatSessionResponse
    assistant_message: ChatMessageResponse
