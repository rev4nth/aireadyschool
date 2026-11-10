from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import AuthenticatedUser, get_current_user
from app.models import (
    GapReport,
    Profile,
    Quiz,
    QuizAttempt,
    RevisionPlan,
    RevisionTask,
    Subject,
    TopicMastery,
)
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
    not_assessed = sum(
        1
        for m in mastery_rows
        if m.classification == "not_assessed" or int(m.questions_attempted or 0) <= 0
    )
    assessed = [m for m in mastery_rows if int(m.questions_attempted or 0) > 0]
    overall = (
        sum(m.mastery_score for m in assessed) / len(assessed) if assessed else 0.0
    )

    profile = await db.get(Profile, user.id)

    quiz_count_q = (
        select(func.count())
        .select_from(QuizAttempt)
        .join(Quiz, Quiz.id == QuizAttempt.quiz_id)
        .where(QuizAttempt.user_id == user.id, QuizAttempt.status == "submitted")
    )
    if subject_id:
        quiz_count_q = quiz_count_q.where(Quiz.subject_id == subject_id)
    quizzes_completed = await db.scalar(quiz_count_q)

    tasks_q = (
        select(RevisionTask)
        .join(RevisionPlan, RevisionPlan.id == RevisionTask.plan_id)
        .where(RevisionTask.user_id == user.id)
    )
    if subject_id:
        tasks_q = tasks_q.where(RevisionPlan.subject_id == subject_id)
    tasks = list((await db.execute(tasks_q)).scalars().all())
    completed = sum(1 for t in tasks if t.completion_status == "completed")
    plan_pct = (completed / len(tasks) * 100) if tasks else 0.0

    with_history = [
        m
        for m in mastery_rows
        if m.historical_avg is not None and m.recent_score is not None
    ]
    improvement = 0.0
    if with_history:
        improvement = sum(
            (m.recent_score or 0) - (m.historical_avg or 0) for m in with_history
        ) / len(with_history)

    return ProgressOverview(
        overall_mastery=round(overall, 2),
        weak_topics=weak,
        medium_topics=medium,
        strong_topics=strong,
        not_assessed_topics=not_assessed,
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

    subject_name = None
    if subject_id:
        subject = await db.get(Subject, subject_id)
        if subject and subject.user_id == user.id:
            subject_name = subject.name

    tasks_q = (
        select(RevisionTask)
        .join(RevisionPlan, RevisionPlan.id == RevisionTask.plan_id)
        .where(
            RevisionTask.user_id == user.id,
            RevisionTask.completion_status.in_(["pending", "in_progress"]),
            RevisionPlan.status == "active",
        )
        .order_by(RevisionTask.priority.desc())
        .limit(6)
    )
    if subject_id:
        tasks_q = tasks_q.where(RevisionPlan.subject_id == subject_id)
    upcoming = list((await db.execute(tasks_q)).scalars().all())

    gap_q = select(GapReport).where(GapReport.user_id == user.id).order_by(GapReport.created_at.desc())
    if subject_id:
        gap_q = gap_q.where(GapReport.subject_id == subject_id)
    latest_gap = (await db.execute(gap_q.limit(1))).scalar_one_or_none()

    weak_preview: list[str] = []
    not_assessed_preview: list[str] = []
    if latest_gap and isinstance(latest_gap.topics, list):
        for item in latest_gap.topics:
            if not isinstance(item, dict):
                continue
            name = item.get("topic_name")
            if not name:
                continue
            cls = item.get("classification")
            if cls == "weak" and len(weak_preview) < 5:
                weak_preview.append(str(name))
            if cls == "not_assessed" and len(not_assessed_preview) < 5:
                not_assessed_preview.append(str(name))

    gap_not_assessed = 0
    if latest_gap and isinstance(latest_gap.topics, list):
        gap_not_assessed = sum(
            1
            for item in latest_gap.topics
            if isinstance(item, dict) and item.get("classification") == "not_assessed"
        )

    return DashboardResponse(
        welcome_name=profile.full_name if profile else user.email,
        study_streak=overview.study_streak,
        current_subject_id=subject_id,
        subject_name=subject_name,
        upcoming_tasks=[
            {
                "id": str(t.id),
                "title": t.title,
                "priority": t.priority,
                "duration_minutes": t.duration_minutes,
                "status": t.completion_status,
                "activity": t.activity,
                "scheduled_day": t.scheduled_day,
                "prioritization_reason": t.prioritization_reason,
            }
            for t in upcoming
        ],
        recent_gap_summary=latest_gap.summary if latest_gap else None,
        gap_weak_count=latest_gap.weak_count if latest_gap else overview.weak_topics,
        gap_medium_count=latest_gap.medium_count if latest_gap else overview.medium_topics,
        gap_strong_count=latest_gap.strong_count if latest_gap else overview.strong_topics,
        gap_not_assessed_count=gap_not_assessed or overview.not_assessed_topics,
        weak_topic_preview=weak_preview,
        not_assessed_preview=not_assessed_preview,
        overall_mastery=overview.overall_mastery,
        weak_topic_count=overview.weak_topics,
        medium_topic_count=overview.medium_topics,
        strong_topic_count=overview.strong_topics,
        not_assessed_topic_count=overview.not_assessed_topics,
        quizzes_completed=overview.quizzes_completed,
        plan_completion_pct=overview.plan_completion_pct,
        improvement_pct=overview.improvement_pct,
    )
