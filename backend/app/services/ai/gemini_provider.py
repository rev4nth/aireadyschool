"""Google Gemini LLM provider."""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import TypeVar

import google.generativeai as genai
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


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        settings = get_settings()
        genai.configure(api_key=api_key or settings.gemini_api_key)
        self.model_name = model or settings.gemini_model
        self._model = genai.GenerativeModel(self.model_name)

    async def generate_text(self, prompt: str, *, temperature: float = 0.2) -> str:
        if not prompt or not prompt.strip():
            raise AppError("Prompt must not be empty", status_code=400, code="invalid_input")

        logger.info(
            "gemini.generate_text model=%s prompt_len=%s preview=%s",
            self.model_name,
            len(prompt),
            truncate_for_log(prompt),
        )

        def _call() -> str:
            response = self._model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(temperature=temperature),
            )
            text = getattr(response, "text", None)
            if not text:
                raise ProviderError("Gemini returned empty response")
            return text.strip()

        try:
            return await asyncio.wait_for(asyncio.to_thread(_call), timeout=60)
        except TimeoutError as exc:
            raise ProviderError("Gemini request timed out") from exc
        except ProviderError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise self._map_error(exc) from exc

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
            logger.warning("gemini.structured_parse_failed model=%s", self.model_name)
            raise AppError(
                "Model returned invalid structured output",
                status_code=422,
                code="invalid_structured_output",
            ) from exc

    def _map_error(self, exc: Exception) -> Exception:
        message = str(exc).lower()
        status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
        if status == 429 or ("rate" in message and "limit" in message):
            return ProviderError("Gemini rate limit exceeded")
        if status is not None:
            try:
                if int(status) >= 500:
                    return ProviderError(f"Gemini server error ({status})")
            except (TypeError, ValueError):
                pass
        if "timeout" in message or "timed out" in message:
            return ProviderError("Gemini request timed out")
        return ProviderError(f"Gemini provider error: {type(exc).__name__}")
