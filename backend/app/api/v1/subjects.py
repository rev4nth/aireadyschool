from uuid import UUID

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import ensure_owner
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.core.security import AuthenticatedUser, get_current_user
from app.models import Subject
from app.schemas.subjects import SubjectCreate, SubjectResponse, SubjectUpdate

router = APIRouter()


@router.get("", response_model=list[SubjectResponse])
async def list_subjects(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Subject]:
    result = await db.execute(
        select(Subject).where(Subject.user_id == user.id).order_by(Subject.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=SubjectResponse, status_code=201)
async def create_subject(
    payload: SubjectCreate,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Subject:
    subject = Subject(user_id=user.id, **payload.model_dump())
    db.add(subject)
    await db.flush()
    await db.refresh(subject)
    return subject


@router.get("/{subject_id}", response_model=SubjectResponse)
async def get_subject(
    subject_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Subject:
    subject = await db.get(Subject, subject_id)
    if subject is None:
        raise NotFoundError("Subject not found")
    ensure_owner(subject.user_id, user)
    return subject


@router.patch("/{subject_id}", response_model=SubjectResponse)
async def update_subject(
    subject_id: UUID,
    payload: SubjectUpdate,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Subject:
    subject = await db.get(Subject, subject_id)
    if subject is None:
        raise NotFoundError("Subject not found")
    ensure_owner(subject.user_id, user)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(subject, key, value)
    await db.flush()
    await db.refresh(subject)
    return subject


@router.delete("/{subject_id}", status_code=204, response_class=Response)
async def delete_subject(
    subject_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    subject = await db.get(Subject, subject_id)
    if subject is None:
        raise NotFoundError("Subject not found")
    ensure_owner(subject.user_id, user)
    await db.delete(subject)
    return Response(status_code=204)
