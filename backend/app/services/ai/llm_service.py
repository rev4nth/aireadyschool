"""LLM orchestration: Gemini primary with Groq fallback."""

from __future__ import annotations

import logging
import time
from typing import TypeVar

from pydantic import BaseModel
from tenacity import AsyncRetrying, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.exceptions import AppError, ProviderError
from app.core.redis import metrics
from app.services.ai.base import LLMProvider
from app.services.ai.gemini_provider import GeminiProvider
from app.services.ai.groq_provider import GroqProvider
from app.utils.text import truncate_for_log

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)

_FALLBACK_MARKERS = (
    "timed out",
    "timeout",
    "rate limit",
    "server error",
    "unavailable",
    "overloaded",
    "invalid structured output",
    "503",
    "502",
    "500",
    "504",
    "429",
)


def _is_fallback_eligible(exc: BaseException) -> bool:
    code = getattr(exc, "code", None)
    if code in {"invalid_structured_output"}:
        return True
    if isinstance(exc, AppError) and not isinstance(exc, ProviderError):
        # Allow structured-output parse failures to try Groq.
        message = str(getattr(exc, "message", exc)).lower()
        return "invalid structured output" in message
    message = str(getattr(exc, "message", exc)).lower()
    return any(marker in message for marker in _FALLBACK_MARKERS)


class LLMService:
    """Primary Gemini → Groq fallback with backoff, validation, and metrics."""

    def __init__(
        self,
        primary: LLMProvider | None = None,
        fallback: LLMProvider | None = None,
        *,
        max_attempts: int = 2,
    ) -> None:
        self.primary = primary or GeminiProvider()
        self.fallback = fallback or GroqProvider()
        self.max_attempts = max_attempts

    async def generate_text(
        self, prompt: str, *, temperature: float = 0.2, operation: str = "text"
    ) -> str:
        return await self._run(prompt, schema=None, temperature=temperature, operation=operation)  # type: ignore[return-value]

    async def generate_structured(
        self,
        prompt: str,
        schema: type[T],
        *,
        temperature: float = 0.2,
        operation: str = "structured",
    ) -> T:
        return await self._run(  # type: ignore[return-value]
            prompt, schema=schema, temperature=temperature, operation=operation
        )

    async def _run(
        self,
        prompt: str,
        *,
        schema: type[BaseModel] | None,
        temperature: float,
        operation: str,
    ) -> BaseModel | str:
        if not prompt or not str(prompt).strip():
            raise AppError("Prompt must not be empty", status_code=400, code="invalid_input")

        providers = [self.primary, self.fallback]
        last_error: BaseException | None = None
        used_fallback = False

        for index, provider in enumerate(providers):
            if index > 0:
                used_fallback = True
                metrics.fallback_count += 1
                logger.warning("llm.fallback_to provider=%s operation=%s", provider.name, operation)

            started = time.perf_counter()
            try:
                result = await self._call_with_backoff(provider, prompt, schema, temperature)
                latency = (time.perf_counter() - started) * 1000
                metrics.ai_calls += 1
                metrics.ai_latency_ms_total += latency
                logger.info(
                    "llm.success provider=%s operation=%s fallback=%s latency_ms=%.1f preview=%s",
                    provider.name,
                    operation,
                    used_fallback,
                    latency,
                    truncate_for_log(prompt),
                )
                return result
            except Exception as exc:  # noqa: BLE001
                latency = (time.perf_counter() - started) * 1000
                metrics.ai_calls += 1
                metrics.ai_latency_ms_total += latency
                last_error = exc
                if not _is_fallback_eligible(exc):
                    raise
                logger.warning(
                    "llm.provider_failed provider=%s operation=%s error=%s",
                    provider.name,
                    operation,
                    type(exc).__name__,
                )

        raise ProviderError(
            f"All LLM providers failed for {operation}: "
            f"{type(last_error).__name__ if last_error else 'unknown'}"
        )

    async def _call_with_backoff(
        self,
        provider: LLMProvider,
        prompt: str,
        schema: type[BaseModel] | None,
        temperature: float,
    ) -> BaseModel | str:
        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(self.max_attempts),
            wait=wait_exponential(multiplier=0.5, min=0.5, max=8),
            retry=retry_if_exception_type(ProviderError),
            reraise=True,
        ):
            with attempt:
                if schema is None:
                    return await provider.generate_text(prompt, temperature=temperature)
                return await provider.generate_structured(
                    prompt, schema, temperature=temperature
                )
        raise ProviderError(f"{provider.name} exhausted retries")


_llm_service: LLMService | None = None


def get_llm_service() -> LLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service
