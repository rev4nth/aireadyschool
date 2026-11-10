"""Groq LLM provider (fallback)."""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import TypeVar

from groq import APIStatusError, AsyncGroq
from groq import RateLimitError as GroqRateLimitError
from pydantic import BaseModel, ValidationError

from app.core.config import get_settings
from app.core.exceptions import AppError, ProviderError
from app.services.ai.base import LLMProvider
from app.utils.text import truncate_for_log

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)
_JSON_FENCE = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)


def _extract_json(text: str) -> str:
    text = text.strip()
    match = _JSON_FENCE.search(text)
    if match:
        return match.group(1).strip()
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        return text[start : end + 1]
    start_a, end_a = text.find("["), text.rfind("]")
    if start_a != -1 and end_a > start_a:
        return text[start_a : end_a + 1]
    return text


class GroqProvider(LLMProvider):
    name = "groq"

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        settings = get_settings()
        self.model_name = model or settings.groq_model
        self._client = AsyncGroq(api_key=api_key or settings.groq_api_key)

    async def generate_text(self, prompt: str, *, temperature: float = 0.2) -> str:
        if not prompt or not prompt.strip():
            raise AppError("Prompt must not be empty", status_code=400, code="invalid_input")

        logger.info(
            "groq.generate_text model=%s prompt_len=%s preview=%s",
            self.model_name,
            len(prompt),
            truncate_for_log(prompt),
        )
        try:
            response = await asyncio.wait_for(
                self._client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a careful study assistant. Follow instructions exactly.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    temperature=temperature,
                ),
                timeout=60,
            )
        except TimeoutError as exc:
            raise ProviderError("Groq request timed out") from exc
        except GroqRateLimitError as exc:
            raise ProviderError("Groq rate limit exceeded") from exc
        except APIStatusError as exc:
            if exc.status_code == 429:
                raise ProviderError("Groq rate limit exceeded") from exc
            if exc.status_code >= 500:
                raise ProviderError(f"Groq server error ({exc.status_code})") from exc
            raise ProviderError(f"Groq API error ({exc.status_code})") from exc
        except Exception as exc:  # noqa: BLE001
            raise ProviderError(f"Groq provider error: {type(exc).__name__}") from exc

        text = response.choices[0].message.content if response.choices else None
        if not text:
            raise ProviderError("Groq returned empty response")
        return text.strip()

    async def generate_structured(
        self, prompt: str, schema: type[T], *, temperature: float = 0.2
    ) -> T:
        schema_json = json.dumps(schema.model_json_schema())
        full_prompt = (
            f"{prompt}\n\n"
            "Return ONLY valid JSON matching this JSON Schema. No markdown.\n"
            f"SCHEMA:\n{schema_json}"
        )
        raw = await self.generate_text(full_prompt, temperature=temperature)
        try:
            return schema.model_validate(json.loads(_extract_json(raw)))
        except (json.JSONDecodeError, ValidationError) as exc:
            logger.warning("groq.structured_parse_failed model=%s", self.model_name)
            raise AppError(
                "Model returned invalid structured output",
                status_code=422,
                code="invalid_structured_output",
            ) from exc
