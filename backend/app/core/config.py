"""Application configuration with startup validation."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: Literal["development", "staging", "production"] = "development"
    app_secret_key: str = Field(..., min_length=16)
    frontend_url: str = "http://localhost:5173"
    backend_url: str = "http://localhost:8000"

    supabase_url: str = Field(...)
    supabase_anon_key: str = Field(...)
    supabase_service_role_key: str = Field(...)
    supabase_jwt_secret: str = Field(...)

    database_url: str = Field(...)
    redis_url: str = "redis://localhost:6379/0"

    gemini_api_key: str = Field(...)
    gemini_model: str = "gemini-2.0-flash"
    gemini_embedding_model: str = "text-embedding-004"

    groq_api_key: str = Field(...)
    groq_model: str = "llama-3.3-70b-versatile"

    max_upload_size_mb: int = 20
    rate_limit_per_minute: int = 60

    mastery_weak_threshold: float = 50.0
    mastery_strong_threshold: float = 75.0
    cache_ttl_seconds: int = 3600
    prompt_version: str = "v1"

    storage_bucket: str = "materials"
    embedding_dimensions: int = 768
    chunk_size: int = 800
    chunk_overlap: int = 120
    retrieval_top_k: int = 8

    @field_validator("frontend_url", "backend_url", "supabase_url")
    @classmethod
    def strip_trailing_slash(cls, value: str) -> str:
        return value.rstrip("/")

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024

    @property
    def cors_origins(self) -> list[str]:
        return [self.frontend_url]


@lru_cache
def get_settings() -> Settings:
    try:
        return Settings()
    except Exception as exc:  # noqa: BLE001
        missing = []
        if hasattr(exc, "errors"):
            for err in exc.errors():  # type: ignore[attr-defined]
                loc = ".".join(str(x) for x in err.get("loc", []))
                missing.append(loc.upper())
        detail = ", ".join(missing) if missing else str(exc)
        raise RuntimeError(
            f"Missing or invalid environment variables: {detail}. "
            "Copy backend/.env.example to backend/.env and fill in required values."
        ) from exc
