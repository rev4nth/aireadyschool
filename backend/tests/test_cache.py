import pytest
import fakeredis.aioredis

from app.core import redis as redis_mod


@pytest.mark.asyncio
async def test_cache_hit_and_miss(monkeypatch):
    fake = fakeredis.aioredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr(redis_mod, "_redis", fake)
    redis_mod.metrics.hits = 0
    redis_mod.metrics.misses = 0

    miss = await redis_mod.cache_get("missing-key")
    assert miss is None
    assert redis_mod.metrics.misses == 1

    await redis_mod.cache_set("demo-key", {"ok": True}, ttl=60)
    hit = await redis_mod.cache_get("demo-key")
    assert hit == {"ok": True}
    assert redis_mod.metrics.hits == 1


@pytest.mark.asyncio
async def test_rate_limit(monkeypatch):
    fake = fakeredis.aioredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr(redis_mod, "_redis", fake)
    key = "rl:test:user"
    assert await redis_mod.rate_limit(key, limit=2, window_seconds=60) is True
    assert await redis_mod.rate_limit(key, limit=2, window_seconds=60) is True
    assert await redis_mod.rate_limit(key, limit=2, window_seconds=60) is False
