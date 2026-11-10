"""Redis client and cache helpers."""

from __future__ import annotations

import json
import logging
from typing import Any

import redis.asyncio as redis

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class CacheMetrics:
    def __init__(self) -> None:
        self.hits = 0
        self.misses = 0
        self.ai_latency_ms_total = 0.0
        self.ai_calls = 0
        self.fallback_count = 0

    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        return (self.hits / total) if total else 0.0

    def snapshot(self) -> dict[str, Any]:
        avg_latency = (
            self.ai_latency_ms_total / self.ai_calls if self.ai_calls else 0.0
        )
        return {
            "cache_hits": self.hits,
            "cache_misses": self.misses,
            "cache_hit_rate": round(self.hit_rate, 4),
            "ai_calls": self.ai_calls,
            "ai_latency_ms_avg": round(avg_latency, 2),
            "fallback_usage": self.fallback_count,
        }


metrics = CacheMetrics()
_redis: redis.Redis | None = None


async def get_redis() -> redis.Redis:
    global _redis
    if _redis is None:
        settings = get_settings()
        _redis = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def close_redis() -> None:
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None


async def cache_get(key: str) -> Any | None:
    client = await get_redis()
    try:
        raw = await client.get(key)
    except Exception:  # noqa: BLE001
        logger.warning("Redis get failed for key namespace=%s", key.split(":")[0])
        metrics.misses += 1
        return None

    if raw is None:
        metrics.misses += 1
        return None

    metrics.hits += 1
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        metrics.misses += 1
        return None


async def cache_set(key: str, value: Any, ttl: int | None = None) -> None:
    client = await get_redis()
    settings = get_settings()
    payload = json.dumps(value, default=str)
    try:
        await client.set(key, payload, ex=ttl or settings.cache_ttl_seconds)
    except Exception:  # noqa: BLE001
        logger.warning("Redis set failed for key namespace=%s", key.split(":")[0])


async def cache_delete_pattern(pattern: str) -> int:
    client = await get_redis()
    deleted = 0
    try:
        async for key in client.scan_iter(match=pattern, count=100):
            await client.delete(key)
            deleted += 1
    except Exception:  # noqa: BLE001
        logger.warning("Redis delete pattern failed for %s", pattern)
    return deleted


async def rate_limit(key: str, limit: int, window_seconds: int = 60) -> bool:
    """Return True if request is allowed, False if rate limited."""
    client = await get_redis()
    try:
        current = await client.incr(key)
        if current == 1:
            await client.expire(key, window_seconds)
        return current <= limit
    except Exception:  # noqa: BLE001
        logger.warning("Rate limit check failed; allowing request")
        return True
