"""SQLAlchemy async engine and session management."""

from __future__ import annotations

import ssl
from collections.abc import AsyncGenerator
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


def _to_async_url(url: str) -> str:
    if url.startswith("postgresql+asyncpg://"):
        return url
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url


def _supabase_ssl_context() -> ssl.SSLContext:
    # Supabase pooler often presents an intermediate that fails default Windows verification.
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    return context


def _prepare_asyncpg_url(url: str) -> tuple[str, dict, bool]:
    """Convert DB URL for asyncpg.

    Returns (cleaned_url, connect_args, use_null_pool).
    """
    async_url = _to_async_url(url)
    parsed = urlparse(async_url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    connect_args: dict = {}

    pgbouncer = query.pop("pgbouncer", None)
    sslmode = query.pop("sslmode", None)
    host = parsed.hostname or ""
    port = parsed.port

    using_pooler = (
        pgbouncer in {"true", "1", "yes"}
        or "pooler.supabase" in host
        or port in {6543, 5432}
    )
    # Supabase transaction pooler (:6543) does not support prepared statements.
    transaction_mode = port == 6543 or pgbouncer in {"true", "1", "yes"}

    if using_pooler or transaction_mode:
        connect_args["statement_cache_size"] = 0
        connect_args["prepared_statement_name_func"] = lambda: f"__gf_{uuid4().hex}__"

    if sslmode != "disable" and (
        sslmode
        or using_pooler
        or any(marker in host for marker in ("supabase.com", "supabase.co", "pooler.supabase"))
    ):
        connect_args["ssl"] = _supabase_ssl_context()

    cleaned = parsed._replace(query=urlencode(query))
    return urlunparse(cleaned), connect_args, transaction_mode


_engine = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_engine():
    global _engine, _session_factory
    if _engine is None:
        settings = get_settings()
        db_url, connect_args, use_null_pool = _prepare_asyncpg_url(settings.database_url)
        engine_kwargs: dict = {
            "echo": settings.app_env == "development",
            "pool_pre_ping": True,
            "connect_args": connect_args,
        }
        if use_null_pool or settings.is_production:
            # Best fit for Supabase transaction pooler.
            engine_kwargs["poolclass"] = NullPool
        else:
            engine_kwargs.update(
                pool_size=3,
                max_overflow=2,
                pool_recycle=180,
                pool_timeout=30,
            )
        _engine = create_async_engine(db_url, **engine_kwargs)
        _session_factory = async_sessionmaker(
            _engine, expire_on_commit=False, class_=AsyncSession
        )
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    get_engine()
    assert _session_factory is not None
    return _session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
