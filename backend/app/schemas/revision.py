"""Revision plan schemas."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel

TaskStatus = Literal["pending", "in_progress", "completed", "skipped"]


class RevisionPlanCreate(BaseModel):
    subject_id: UUID
    gap_report_id: UUID | None = None
    title: str | None = Field(default=None, max_length=300)
    exam_date: date | None = None
    available_days: int = Field(default=7, ge=1, le=120)
    hours_per_day: float = Field(default=2.0, gt=0, le=16)
    preferences: dict[str, Any] = Field(default_factory=dict)


class RevisionTaskUpdate(BaseModel):
    completion_status: TaskStatus


class RevisionTaskResponse(ORMModel):
    id: UUID
    plan_id: UUID
    user_id: UUID
    topic_id: UUID | None = None
    title: str
    priority: float
    duration_minutes: int
    activity: str
    source_material: list[Any] = Field(default_factory=list)
    practice_questions: list[Any] = Field(default_factory=list)
    completion_status: str
    target_mastery: float | None = None
    prioritization_reason: str | None = None
    scheduled_day: int | None = None
    completed_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class RevisionPlanResponse(ORMModel):
    id: UUID
    user_id: UUID
    subject_id: UUID
    gap_report_id: UUID | None = None
    title: str
    exam_date: date | None = None
    available_days: int | None = None
    hours_per_day: float | None = None
    preferences: dict[str, Any] = Field(default_factory=dict)
    change_reason: str | None = None
    status: str
    tasks: list[RevisionTaskResponse] = Field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None
