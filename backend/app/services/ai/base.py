"""Abstract LLM provider interface."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class LLMProvider(ABC):
    """Provider-agnostic async LLM interface."""

    name: str = "base"

    @abstractmethod
    async def generate_structured(
        self, prompt: str, schema: type[T], *, temperature: float = 0.2
    ) -> T:
        """Generate a response validated against a Pydantic schema."""

    @abstractmethod
    async def generate_text(self, prompt: str, *, temperature: float = 0.2) -> str:
        """Generate free-form text."""
