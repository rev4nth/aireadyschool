from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import AuthenticatedUser, get_current_user
from app.models import GapReport, Profile, QuizAttempt, RevisionPlan, RevisionTask, TopicMastery
from app.schemas.progress import DashboardResponse, ProgressOverview

router = APIRouter()


@router.get("/overview", response_model=ProgressOverview)
async def progress_overview(
    subject_id: UUID | None = None,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProgressOverview:
    mastery_q = select(TopicMastery).where(TopicMastery.user_id == user.id)
    if subject_id:
        mastery_q = mastery_q.where(TopicMastery.subject_id == subject_id)
    mastery_rows = list((await db.execute(mastery_q)).scalars().all())

    weak = sum(1 for m in mastery_rows if m.classification == "weak")
    medium = sum(1 for m in mastery_rows if m.classification == "medium")
    strong = sum(1 for m in mastery_rows if m.classification == "strong")
    overall = (
        sum(m.mastery_score for m in mastery_rows) / len(mastery_rows) if mastery_rows else 0.0
    )

    profile = await db.get(Profile, user.id)
    quizzes_completed = await db.scalar(
        select(func.count())
        .select_from(QuizAttempt)
        .where(QuizAttempt.user_id == user.id, QuizAttempt.status == "submitted")
    )

    tasks_q = select(RevisionTask).where(RevisionTask.user_id == user.id)
    tasks = list((await db.execute(tasks_q)).scalars().all())
    completed = sum(1 for t in tasks if t.completion_status == "completed")
    plan_pct = (completed / len(tasks) * 100) if tasks else 0.0

    # Improvement: compare latest vs earliest recent scores where available
    with_history = [m for m in mastery_rows if m.historical_avg is not None and m.recent_score is not None]
    improvement = 0.0
    if with_history:
        improvement = sum((m.recent_score or 0) - (m.historical_avg or 0) for m in with_history) / len(
            with_history
        )

    return ProgressOverview(
        overall_mastery=round(overall, 2),
        weak_topics=weak,
        medium_topics=medium,
        strong_topics=strong,
        study_streak=profile.study_streak if profile else 0,
        quizzes_completed=quizzes_completed or 0,
        plan_completion_pct=round(plan_pct, 2),
        improvement_pct=round(improvement, 2),
    )


@router.get("/dashboard", response_model=DashboardResponse)
async def dashboard(
    subject_id: UUID | None = None,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DashboardResponse:
    overview = await progress_overview(subject_id, user, db)
    profile = await db.get(Profile, user.id)

    tasks_q = (
        select(RevisionTask)
        .where(
            RevisionTask.user_id == user.id,
            RevisionTask.completion_status.in_(["pending", "in_progress"]),
        )
        .order_by(RevisionTask.priority.desc())
        .limit(5)
    )
    upcoming = list((await db.execute(tasks_q)).scalars().all())

    gap_q = select(GapReport).where(GapReport.user_id == user.id).order_by(GapReport.created_at.desc())
    if subject_id:
        gap_q = gap_q.where(GapReport.subject_id == subject_id)
    latest_gap = (await db.execute(gap_q.limit(1))).scalar_one_or_none()

    return DashboardResponse(
        welcome_name=profile.full_name if profile else user.email,
        study_streak=overview.study_streak,
        current_subject_id=subject_id,
        upcoming_tasks=[
            {
                "id": str(t.id),
                "title": t.title,
                "priority": t.priority,
                "duration_minutes": t.duration_minutes,
                "status": t.completion_status,
            }
            for t in upcoming
        ],
        recent_gap_summary=latest_gap.summary if latest_gap else None,
        overall_mastery=overview.overall_mastery,
        weak_topic_count=overview.weak_topics,
    )
