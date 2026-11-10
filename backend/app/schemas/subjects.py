"""Subject schemas."""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class SubjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    exam_date: date | None = None
    color: str | None = Field(default="#2563eb", max_length=32)


class SubjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    exam_date: date | None = None
    color: str | None = Field(default=None, max_length=32)


class SubjectResponse(ORMModel):
    id: UUID
    user_id: UUID
    name: str
    description: str | None = None
    exam_date: date | None = None
    color: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
