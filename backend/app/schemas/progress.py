"""Progress / analytics schemas."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class ProgressOverview(BaseModel):
    overall_mastery: float = 0.0
    weak_topics: int = 0
    medium_topics: int = 0
    strong_topics: int = 0
    study_streak: int = 0
    quizzes_completed: int = 0
    plan_completion_pct: float = 0.0
    improvement_pct: float = 0.0


class DashboardResponse(BaseModel):
    welcome_name: str | None = None
    study_streak: int = 0
    current_subject_id: UUID | None = None
    upcoming_tasks: list[dict[str, Any]] = Field(default_factory=list)
    recent_gap_summary: str | None = None
    overall_mastery: float = 0.0
    weak_topic_count: int = 0


class AnalyticsResponse(BaseModel):
    overview: ProgressOverview
    mastery_distribution: list[dict[str, Any]] = Field(default_factory=list)
    quiz_performance_over_time: list[dict[str, Any]] = Field(default_factory=list)
    topic_progress_lines: list[dict[str, Any]] = Field(default_factory=list)
    most_improved_topics: list[dict[str, Any]] = Field(default_factory=list)
    persistent_weak_topics: list[dict[str, Any]] = Field(default_factory=list)
    attempt_history: list[dict[str, Any]] = Field(default_factory=list)
    cache_metrics: dict[str, Any] = Field(default_factory=dict)
