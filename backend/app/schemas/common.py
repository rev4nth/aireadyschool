"""Shared API schema primitives."""

from __future__ import annotations

from typing import Any, Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class MessageResponse(BaseModel):
    message: str


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    has_more: bool = False


class CitationSchema(BaseModel):
    chunk_id: UUID
    document_title: str | None = None
    page_number: int | None = None
    section_heading: str | None = None
    excerpt: str | None = None
    score: float | None = None


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str | None = None
    metrics: dict[str, Any] | None = None
