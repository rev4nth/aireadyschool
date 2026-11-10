"""Gap analysis report schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel

MasteryClass = Literal["weak", "medium", "strong"]


class GapReportGenerateRequest(BaseModel):
    subject_id: UUID
    attempt_id: UUID | None = None


class GapReportResponse(ORMModel):
    id: UUID
    user_id: UUID
    subject_id: UUID
    attempt_id: UUID | None = None
    summary: str | None = None
    topics: list[Any] = Field(default_factory=list)
    overall_mastery: float | None = None
    weak_count: int = 0
    medium_count: int = 0
    strong_count: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None
