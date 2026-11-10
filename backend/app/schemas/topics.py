"""Topic map schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class TopicMapGenerateRequest(BaseModel):
    subject_id: UUID
    replace_existing: bool = True


class TopicUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = None
    exam_importance: float | None = Field(default=None, ge=0, le=100)
    past_paper_frequency: int | None = Field(default=None, ge=0)
    parent_id: UUID | None = None


class TopicResponse(ORMModel):
    id: UUID
    user_id: UUID
    subject_id: UUID
    parent_id: UUID | None = None
    name: str
    description: str | None = None
    exam_importance: float = 50.0
    past_paper_frequency: int = 0
    mastery_score: float = 0.0
    source_sections: list[Any] = Field(default_factory=list)
    children: list[TopicResponse] = Field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None


class TopicMapResponse(BaseModel):
    subject_id: UUID
    topics: list[TopicResponse]


class TopicMaterialResponse(BaseModel):
    topic_id: UUID
    documents: list[dict[str, Any]] = Field(default_factory=list)
    chunks: list[dict[str, Any]] = Field(default_factory=list)


class TopicNodeLLM(BaseModel):
    name: str = Field(min_length=1, max_length=300)
    description: str | None = None
    exam_importance: float = Field(default=50.0, ge=0, le=100)
    past_paper_frequency: int = Field(default=0, ge=0)
    source_sections: list[Any] = Field(default_factory=list)
    children: list[TopicNodeLLM] = Field(default_factory=list)


class TopicMapLLMSchema(BaseModel):
    topics: list[TopicNodeLLM] = Field(default_factory=list)
