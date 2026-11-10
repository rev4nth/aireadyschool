"""Profile schemas."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=200)
    avatar_url: str | None = Field(default=None, max_length=1000)
    preferences: dict[str, Any] | None = None


class ProfileResponse(ORMModel):
    id: UUID
    email: EmailStr | None = None
    full_name: str | None = None
    avatar_url: str | None = None
    study_streak: int = 0
    last_study_date: date | None = None
    preferences: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None
    updated_at: datetime | None = None
