"""Shared API dependencies."""

from uuid import UUID

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.core.exceptions import ForbiddenError, RateLimitError
from app.core.redis import rate_limit
from app.core.security import AuthenticatedUser, get_current_user


async def enforce_rate_limit(
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser:
    key = f"rl:{user.id}:{request.url.path}"
    allowed = await rate_limit(key, settings.rate_limit_per_minute, 60)
    if not allowed:
        raise RateLimitError()
    return user


def ensure_owner(resource_user_id: UUID, current_user: AuthenticatedUser) -> None:
    if resource_user_id != current_user.id:
        raise ForbiddenError("You do not have access to this resource")


DbSession = Depends(get_db)
CurrentUser = Depends(get_current_user)
RateLimitedUser = Depends(enforce_rate_limit)
