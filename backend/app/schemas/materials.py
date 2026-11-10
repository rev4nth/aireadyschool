"""Study material / document schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel

DocType = Literal["syllabus", "textbook", "notes", "past_paper", "text"]
DocStatus = Literal["pending", "processing", "processed", "failed"]


class MaterialCreateText(BaseModel):
    subject_id: UUID
    title: str = Field(min_length=1, max_length=300)
    content: str = Field(min_length=1, max_length=500_000)
    doc_type: DocType = "notes"


class MaterialResponse(ORMModel):
    id: UUID
    user_id: UUID
    subject_id: UUID | None = None
    title: str
    doc_type: str
    file_name: str | None = None
    storage_path: str | None = None
    mime_type: str | None = None
    file_size_bytes: int | None = None
    status: str
    error_message: str | None = None
    page_count: int | None = None
    material_version: int = 1
    metadata: dict[str, Any] = Field(default_factory=dict, validation_alias="metadata_")
    created_at: datetime | None = None
    updated_at: datetime | None = None


class MaterialListResponse(BaseModel):
    items: list[MaterialResponse]
    total: int


class ProcessStatusResponse(BaseModel):
    id: UUID
    status: str
    error_message: str | None = None
    page_count: int | None = None
    chunk_count: int = 0
