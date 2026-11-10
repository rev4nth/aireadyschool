import pytest
from pydantic import BaseModel

from app.core.exceptions import AppError, ProviderError
from app.services.ai.llm_service import LLMService


class TinySchema(BaseModel):
    value: str = "default"


@pytest.mark.asyncio
async def test_groq_fallback_on_gemini_timeout(mock_provider):
    primary = mock_provider(fail=True, fail_message="Gemini request timed out")
    fallback = mock_provider(response={"value": "ok"})
    service = LLMService(primary=primary, fallback=fallback, max_attempts=1)
    result = await service.generate_structured("prompt", TinySchema)
    assert result.value == "ok"
    assert primary.calls >= 1
    assert fallback.calls == 1


@pytest.mark.asyncio
async def test_no_fallback_on_invalid_input(mock_provider):
    primary = mock_provider(fail=True, fail_message="invalid user input schema")
    fallback = mock_provider(response={"value": "should-not-use"})
    service = LLMService(primary=primary, fallback=fallback, max_attempts=1)
    with pytest.raises((ProviderError, AppError)):
        await service.generate_structured("prompt", TinySchema)
    assert fallback.calls == 0


@pytest.mark.asyncio
async def test_both_providers_fail(mock_provider):
    primary = mock_provider(fail=True, fail_message="503 unavailable")
    fallback = mock_provider(fail=True, fail_message="503 unavailable")
    service = LLMService(primary=primary, fallback=fallback, max_attempts=1)
    with pytest.raises(ProviderError):
        await service.generate_structured("prompt", TinySchema)
