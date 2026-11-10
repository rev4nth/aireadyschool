from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import ensure_owner
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.core.security import AuthenticatedUser, get_current_user
from app.models import RevisionPlan, RevisionTask, Subject
from app.schemas.revision import (
    RevisionPlanCreate,
    RevisionPlanResponse,
    RevisionTaskResponse,
    RevisionTaskUpdate,
)

router = APIRouter()


@router.get("", response_model=list[RevisionPlanResponse])
async def list_plans(
    subject_id: UUID | None = None,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[RevisionPlan]:
    query = (
        select(RevisionPlan)
        .where(RevisionPlan.user_id == user.id)
        .options(selectinload(RevisionPlan.tasks))
        .order_by(RevisionPlan.created_at.desc())
    )
    if subject_id:
        query = query.where(RevisionPlan.subject_id == subject_id)
    result = await db.execute(query)
    return list(result.scalars().unique().all())


@router.post("", response_model=RevisionPlanResponse, status_code=201)
async def create_plan(
    payload: RevisionPlanCreate,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RevisionPlan:
    subject = await db.get(Subject, payload.subject_id)
    if subject is None:
        raise NotFoundError("Subject not found")
    ensure_owner(subject.user_id, user)

    from app.services.revision.planner import generate_revision_plan

    plan = await generate_revision_plan(db, user.id, payload)
    await db.refresh(plan, attribute_names=["tasks"])
    return plan


@router.get("/{plan_id}", response_model=RevisionPlanResponse)
async def get_plan(
    plan_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RevisionPlan:
    result = await db.execute(
        select(RevisionPlan)
        .where(RevisionPlan.id == plan_id)
        .options(selectinload(RevisionPlan.tasks))
    )
    plan = result.scalar_one_or_none()
    if plan is None:
        raise NotFoundError("Revision plan not found")
    ensure_owner(plan.user_id, user)
    return plan


@router.get("/{plan_id}/tasks", response_model=list[RevisionTaskResponse])
async def list_tasks(
    plan_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[RevisionTask]:
    plan = await db.get(RevisionPlan, plan_id)
    if plan is None:
        raise NotFoundError("Revision plan not found")
    ensure_owner(plan.user_id, user)
    result = await db.execute(
        select(RevisionTask)
        .where(RevisionTask.plan_id == plan_id, RevisionTask.user_id == user.id)
        .order_by(RevisionTask.priority.desc())
    )
    return list(result.scalars().all())


@router.patch("/{plan_id}/tasks/{task_id}", response_model=RevisionTaskResponse)
async def update_task(
    plan_id: UUID,
    task_id: UUID,
    payload: RevisionTaskUpdate,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RevisionTask:
    task = await db.get(RevisionTask, task_id)
    if task is None or task.plan_id != plan_id:
        raise NotFoundError("Task not found")
    ensure_owner(task.user_id, user)
    task.completion_status = payload.completion_status
    if payload.completion_status == "completed":
        from datetime import datetime, timezone

        task.completed_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(task)
    return task


@router.post("/{plan_id}/recalculate", response_model=RevisionPlanResponse)
async def recalculate_plan(
    plan_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RevisionPlan:
    plan = await db.get(RevisionPlan, plan_id)
    if plan is None:
        raise NotFoundError("Revision plan not found")
    ensure_owner(plan.user_id, user)

    from app.services.revision.planner import recalculate_revision_plan

    updated = await recalculate_revision_plan(db, plan)
    await db.refresh(updated, attribute_names=["tasks"])
    return updated
