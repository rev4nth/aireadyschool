"""Test fixtures with mocked settings and AI providers."""

from __future__ import annotations

import os
from typing import Any
from uuid import uuid4

import pytest
from pydantic import BaseModel

os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("APP_SECRET_KEY", "test-secret-key-123456")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")
os.environ.setdefault("BACKEND_URL", "http://localhost:8000")
os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret-which-is-long-enough")
os.environ.setdefault(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/gapfinder_test"
)
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/15")
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-key")
os.environ.setdefault("GROQ_API_KEY", "test-groq-key")

from app.core.config import get_settings
from app.services.ai.base import LLMProvider
from app.services.rag.retrieval import RetrievedChunk

get_settings.cache_clear()


class MockProvider(LLMProvider):
    name = "mock"

    def __init__(self, response: Any = None, fail: bool = False, fail_message: str = "timed out"):
        self.response = response
        self.fail = fail
        self.fail_message = fail_message
        self.calls = 0

    async def generate_text(self, prompt: str, *, temperature: float = 0.2) -> str:
        self.calls += 1
        if self.fail:
            from app.core.exceptions import ProviderError

            raise ProviderError(self.fail_message)
        if isinstance(self.response, str):
            return self.response
        return "{}"

    async def generate_structured(
        self, prompt: str, schema: type[BaseModel], *, temperature: float = 0.2
    ):
        self.calls += 1
        if self.fail:
            from app.core.exceptions import ProviderError

            raise ProviderError(self.fail_message)
        if isinstance(self.response, schema):
            return self.response
        if isinstance(self.response, dict):
            return schema.model_validate(self.response)
        return schema.model_validate({})


@pytest.fixture
def mock_provider():
    return MockProvider


@pytest.fixture
def sample_chunks():
    cid = uuid4()
    did = uuid4()
    return [
        RetrievedChunk(
            chunk_id=cid,
            document_id=did,
            document_title="Syllabus",
            page_number=1,
            section_heading="Recursion",
            content="A recursive function needs a base case to terminate.",
            score=0.9,
        )
    ]
