"""Validated cache get/set/invalidate helpers."""

from __future__ import annotations

import logging
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from app.core.config import get_settings
from app.core.exceptions import AppError
from app.core.redis import cache_delete_pattern, cache_get, cache_set, get_redis
from app.services.cache.keys import materials_user_pattern

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)


def _validate_key(key: str, *, allow_pattern: bool = False) -> None:
    if not key or not isinstance(key, str):
        raise AppError("Cache key must be a non-empty string", status_code=400)
    if len(key) > 512:
        raise AppError("Cache key too long", status_code=400)
    if " " in key:
        raise AppError("Cache key must not contain spaces", status_code=400)
    if not allow_pattern and "*" in key:
        raise AppError("Cache key must not contain wildcards", status_code=400)
    if ":" not in key:
        raise AppError("Cache key must include a namespace prefix", status_code=400)


async def get_json(key: str) -> Any | None:
    _validate_key(key)
    return await cache_get(key)


async def set_json(key: str, value: Any, ttl: int | None = None) -> None:
    _validate_key(key)
    settings = get_settings()
    await cache_set(key, value, ttl=ttl or settings.cache_ttl_seconds)


async def invalidate_pattern(pattern: str) -> int:
    _validate_key(pattern, allow_pattern=True)
    return await cache_delete_pattern(pattern)


async def invalidate_user_material_caches(user_id: str) -> int:
    return await invalidate_pattern(materials_user_pattern(user_id))


class CacheService:
    def __init__(self, default_ttl: int | None = None) -> None:
        self.default_ttl = default_ttl or get_settings().cache_ttl_seconds

    async def get_raw(self, key: str) -> Any | None:
        return await get_json(key)

    async def get_model(self, key: str, schema: type[T]) -> T | None:
        raw = await get_json(key)
        if raw is None:
            return None
        try:
            return schema.model_validate(raw)
        except ValidationError:
            logger.warning("cache.validation_failed key_ns=%s", key.split(":")[0])
            await self.invalidate(key)
            return None

    async def set(
        self,
        key: str,
        value: Any,
        *,
        ttl: int | None = None,
        schema: type[BaseModel] | None = None,
    ) -> None:
        payload: Any
        if isinstance(value, BaseModel):
            payload = value.model_dump(mode="json")
        elif schema is not None:
            payload = schema.model_validate(value).model_dump(mode="json")
        else:
            payload = value
        await set_json(key, payload, ttl=ttl or self.default_ttl)

    async def invalidate(self, key_or_pattern: str) -> int:
        if "*" in key_or_pattern:
            return await invalidate_pattern(key_or_pattern)
        client = await get_redis()
        try:
            return int(await client.delete(key_or_pattern))
        except Exception:  # noqa: BLE001
            logger.warning("cache.delete_failed key_ns=%s", key_or_pattern.split(":")[0])
            return 0

    async def invalidate_materials(self, user_id: Any) -> int:
        return await invalidate_user_material_caches(str(user_id))


def get_cache_service() -> CacheService:
    return CacheService()
