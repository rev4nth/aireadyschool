from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import metrics
from app.core.security import AuthenticatedUser, get_current_user
from app.models import QuizAttempt, Topic, TopicMastery
from app.schemas.progress import AnalyticsResponse, ProgressOverview
from app.api.v1.progress import progress_overview

router = APIRouter()


@router.get("", response_model=AnalyticsResponse)
async def analytics(
    subject_id: UUID | None = None,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AnalyticsResponse:
    overview: ProgressOverview = await progress_overview(subject_id, user, db)

    mastery_q = select(TopicMastery).where(TopicMastery.user_id == user.id)
    if subject_id:
        mastery_q = mastery_q.where(TopicMastery.subject_id == subject_id)
    mastery_rows = list((await db.execute(mastery_q)).scalars().all())

    topic_ids = [m.topic_id for m in mastery_rows]
    topics = {}
    if topic_ids:
        topic_result = await db.execute(select(Topic).where(Topic.id.in_(topic_ids)))
        topics = {t.id: t for t in topic_result.scalars().all()}

    distribution = [
        {
            "topic": topics[m.topic_id].name if m.topic_id in topics else str(m.topic_id),
            "mastery": m.mastery_score,
            "classification": m.classification,
        }
        for m in mastery_rows
    ]

    attempts_q = (
        select(QuizAttempt)
        .where(QuizAttempt.user_id == user.id, QuizAttempt.status == "submitted")
        .order_by(QuizAttempt.submitted_at.asc())
    )
    attempts = list((await db.execute(attempts_q)).scalars().all())
    quiz_over_time = [
        {
            "attempt_id": str(a.id),
            "date": a.submitted_at.isoformat() if a.submitted_at else None,
            "score_pct": round((a.score or 0) / (a.max_score or 1) * 100, 2),
        }
        for a in attempts
    ]

    topic_lines = []
    for m in mastery_rows:
        evidence = m.evidence or []
        points = []
        for idx, item in enumerate(evidence[-10:], start=1):
            if isinstance(item, dict) and "score" in item:
                points.append({"attempt": idx, "score": item["score"]})
        if points:
            topic_lines.append(
                {
                    "topic": topics[m.topic_id].name if m.topic_id in topics else str(m.topic_id),
                    "points": points,
                }
            )

    improved = sorted(
        [
            {
                "topic": topics[m.topic_id].name if m.topic_id in topics else str(m.topic_id),
                "delta": round((m.recent_score or 0) - (m.historical_avg or 0), 2),
                "mastery": m.mastery_score,
            }
            for m in mastery_rows
            if m.recent_score is not None and m.historical_avg is not None
        ],
        key=lambda x: x["delta"],
        reverse=True,
    )[:5]

    persistent_weak = [
        {
            "topic": topics[m.topic_id].name if m.topic_id in topics else str(m.topic_id),
            "mastery": m.mastery_score,
            "attempts": m.questions_attempted,
        }
        for m in mastery_rows
        if m.classification == "weak" and m.questions_attempted >= 3
    ]

    return AnalyticsResponse(
        overview=overview,
        mastery_distribution=distribution,
        quiz_performance_over_time=quiz_over_time,
        topic_progress_lines=topic_lines,
        most_improved_topics=improved,
        persistent_weak_topics=persistent_weak,
        attempt_history=quiz_over_time,
        cache_metrics=metrics.snapshot(),
    )
