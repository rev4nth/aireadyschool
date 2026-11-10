from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import ensure_owner
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.core.security import AuthenticatedUser, get_current_user
from app.models import Profile
from app.schemas.profile import ProfileResponse, ProfileUpdate

router = APIRouter()


@router.get("", response_model=ProfileResponse)
async def get_profile(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Profile:
    result = await db.execute(select(Profile).where(Profile.id == user.id))
    profile = result.scalar_one_or_none()
    if profile is None:
        profile = Profile(id=user.id, email=user.email, full_name=None, preferences={})
        db.add(profile)
        await db.flush()
    return profile


@router.patch("", response_model=ProfileResponse)
async def update_profile(
    payload: ProfileUpdate,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Profile:
    result = await db.execute(select(Profile).where(Profile.id == user.id))
    profile = result.scalar_one_or_none()
    if profile is None:
        raise NotFoundError("Profile not found")
    ensure_owner(profile.id, user)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(profile, key, value)
    await db.flush()
    await db.refresh(profile)
    return profile
