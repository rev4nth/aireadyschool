"""Gemini embedding generation (text-embedding-004, 768 dims)."""

from __future__ import annotations

import asyncio
import logging
from typing import Sequence

import google.generativeai as genai

from app.core.config import get_settings
from app.core.exceptions import AppError, ProviderError
from app.utils.text import sanitize_text, truncate_for_log

logger = logging.getLogger(__name__)


class EmbeddingService:
    def __init__(self) -> None:
        settings = get_settings()
        genai.configure(api_key=settings.gemini_api_key)
        model = settings.gemini_embedding_model
        self.model = model if model.startswith("models/") else f"models/{model}"
        self.dimensions = settings.embedding_dimensions

    async def embed_text(self, text: str) -> list[float]:
        vectors = await self.embed_texts([text])
        return vectors[0]

    async def embed_query(self, text: str) -> list[float]:
        return await self.embed_text(text)

    async def embed_texts(self, texts: Sequence[str]) -> list[list[float]]:
        if not texts:
            return []
        cleaned = [sanitize_text(t) for t in texts]
        if any(not t for t in cleaned):
            raise AppError("Cannot embed empty text", status_code=400, code="invalid_input")

        logger.info(
            "embeddings.generate model=%s count=%s preview=%s",
            self.model,
            len(cleaned),
            truncate_for_log(cleaned[0]),
        )

        def _embed_one(text: str) -> list[float]:
            result = genai.embed_content(
                model=self.model,
                content=text,
                task_type="retrieval_document",
            )
            values = result.get("embedding") if isinstance(result, dict) else getattr(result, "embedding", None)
            if not values:
                raise ProviderError("Empty embedding response")
            vector = list(values)
            if len(vector) > self.dimensions:
                vector = vector[: self.dimensions]
            elif len(vector) < self.dimensions:
                raise ProviderError(
                    f"Unexpected embedding dimension {len(vector)}; expected {self.dimensions}"
                )
            return [float(x) for x in vector]

        try:
            return await asyncio.wait_for(
                asyncio.to_thread(lambda: [_embed_one(t) for t in cleaned]),
                timeout=90,
            )
        except TimeoutError as exc:
            raise ProviderError("Embedding request timed out") from exc
        except ProviderError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise ProviderError(f"Embedding provider error: {type(exc).__name__}") from exc


_embedding_service: EmbeddingService | None = None


def get_embedding_service() -> EmbeddingService:
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
