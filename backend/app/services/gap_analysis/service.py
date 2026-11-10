"""Build and persist gap reports from quiz attempts + mastery."""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models import (
    GapReport,
    Quiz,
    QuizAttempt,
    QuizQuestion,
    StudentAnswer,
    Subject,
    Topic,
    TopicMastery,
)
from app.services.gap_analysis.scoring import AttemptSignal, MasteryResult, compute_mastery

logger = logging.getLogger(__name__)


async def build_gap_report(
    db: AsyncSession,
    user_id: UUID,
    subject_id: UUID,
    attempt_id: UUID | None = None,
) -> GapReport:
    subject = await db.get(Subject, subject_id)
    if subject is None or subject.user_id != user_id:
        raise NotFoundError("Subject not found")

    topics = list(
        (
            await db.execute(
                select(Topic)
                .where(Topic.user_id == user_id, Topic.subject_id == subject_id)
                .order_by(Topic.name.asc())
            )
        )
        .scalars()
        .all()
    )
    signals_by_topic = await _collect_signals(db, user_id, subject_id, attempt_id)

    topic_payload: list[dict[str, Any]] = []
    weak = medium = strong = 0
    mastery_scores: list[float] = []

    for topic in topics:
        result = compute_mastery(signals_by_topic.get(topic.id, []))
        mastery_scores.append(result.mastery_score)
        if result.classification == "weak":
            weak += 1
        elif result.classification == "medium":
            medium += 1
        else:
            strong += 1

        await _upsert_topic_mastery(db, user_id, subject_id, topic, result)
        topic.mastery_score = result.mastery_score
        topic_payload.append(
            {
                "topic_id": str(topic.id),
                "topic_name": topic.name,
                "mastery_score": result.mastery_score,
                "classification": result.classification,
                "questions_attempted": result.questions_attempted,
                "correct_count": result.correct_count,
                "incorrect_count": result.incorrect_count,
                "recent_score": result.recent_score,
                "historical_avg": result.historical_avg,
                "confidence": result.confidence,
                "evidence": result.evidence,
                "reason": _build_reason(topic.name, result),
                "recommended_focus": _recommend_focus(result.classification, topic.name),
                "formula": result.formula,
            }
        )

    overall = round(sum(mastery_scores) / len(mastery_scores), 2) if mastery_scores else 0.0
    report = GapReport(
        user_id=user_id,
        subject_id=subject_id,
        attempt_id=attempt_id,
        summary=(
            f"{subject.name}: overall mastery {overall:.1f}. "
            f"{weak} weak, {medium} medium, {strong} strong topics. "
            "Evidence is drawn only from your submitted answers."
        ),
        topics=topic_payload,
        overall_mastery=overall,
        weak_count=weak,
        medium_count=medium,
        strong_count=strong,
    )
    db.add(report)
    await db.flush()
    logger.info("gap_report.created id=%s weak=%s medium=%s strong=%s", report.id, weak, medium, strong)
    return report


async def _collect_signals(
    db: AsyncSession,
    user_id: UUID,
    subject_id: UUID,
    attempt_id: UUID | None,
) -> dict[UUID, list[AttemptSignal]]:
    stmt = (
        select(StudentAnswer, QuizQuestion, QuizAttempt)
        .join(QuizQuestion, QuizQuestion.id == StudentAnswer.question_id)
        .join(QuizAttempt, QuizAttempt.id == StudentAnswer.attempt_id)
        .join(Quiz, Quiz.id == QuizAttempt.quiz_id)
        .where(
            StudentAnswer.user_id == user_id,
            Quiz.subject_id == subject_id,
            QuizAttempt.status == "submitted",
        )
    )
    if attempt_id is not None:
        stmt = stmt.where(QuizAttempt.id == attempt_id)

    rows = (await db.execute(stmt)).all()
    by_topic: dict[UUID, list[AttemptSignal]] = defaultdict(list)
    for answer, question, attempt in rows:
        if question.topic_id is None:
            continue
        misconceptions = (answer.evaluation or {}).get("misconceptions") or []
        by_topic[question.topic_id].append(
            AttemptSignal(
                score=float(answer.score if answer.score is not None else 0.0),
                difficulty=question.difficulty or "medium",
                answered_at=attempt.submitted_at or answer.created_at,
                is_correct=answer.is_correct,
                question_id=str(question.id),
                answer_text=answer.answer_text,
                classification=answer.classification,
                misconception=misconceptions[0] if misconceptions else None,
            )
        )
    return by_topic


async def _upsert_topic_mastery(
    db: AsyncSession,
    user_id: UUID,
    subject_id: UUID,
    topic: Topic,
    result: MasteryResult,
) -> TopicMastery:
    existing = await db.execute(
        select(TopicMastery).where(
            TopicMastery.user_id == user_id,
            TopicMastery.topic_id == topic.id,
        )
    )
    row = existing.scalar_one_or_none()
    if row is None:
        row = TopicMastery(user_id=user_id, topic_id=topic.id, subject_id=subject_id)
        db.add(row)

    row.mastery_score = result.mastery_score
    row.classification = result.classification
    row.questions_attempted = result.questions_attempted
    row.correct_count = result.correct_count
    row.incorrect_count = result.incorrect_count
    row.recent_score = result.recent_score
    row.historical_avg = result.historical_avg
    row.confidence = result.confidence
    row.last_assessed_at = datetime.now(timezone.utc)
    row.evidence = result.evidence
    await db.flush()
    return row


def _build_reason(topic_name: str, result: MasteryResult) -> str:
    attempted = int(result.questions_attempted or 0)
    incorrect = int(result.incorrect_count or 0)
    correct = int(result.correct_count or 0)
    if attempted <= 0:
        return (
            f"No quiz answers yet for {topic_name} — marked weak until you attempt "
            "questions on this topic."
        )

    misconceptions = [
        str(item.get("misconception")).strip()
        for item in (result.evidence or [])
        if isinstance(item, dict) and item.get("misconception")
    ]
    top_misconception = next((m for m in misconceptions if m), None)

    base = f"You got {incorrect} of {attempted} questions on {topic_name} wrong"
    if correct and incorrect == 0:
        base = f"You got {correct} of {attempted} questions on {topic_name} correct"
    if top_misconception:
        return f"{base}, mostly about {top_misconception}."
    return f"{base}."


def _recommend_focus(classification: str, topic_name: str) -> str:
    if classification == "weak":
        return f"Prioritize foundational review and guided practice for {topic_name}."
    if classification == "medium":
        return f"Reinforce {topic_name} with mixed-difficulty practice questions."
    return f"Maintain {topic_name} with spaced light review."


async def refresh_mastery_for_subject(
    db: AsyncSession,
    user_id: UUID,
    subject_id: UUID,
    attempt_id: UUID | None = None,
) -> dict[str, Any]:
    """Recompute and persist topic mastery from submitted answers without creating a gap report."""
    topics = list(
        (
            await db.execute(
                select(Topic).where(Topic.user_id == user_id, Topic.subject_id == subject_id)
            )
        )
        .scalars()
        .all()
    )
    signals_by_topic = await _collect_signals(db, user_id, subject_id, attempt_id)
    performance: dict[str, Any] = {}
    for topic in topics:
        result = compute_mastery(signals_by_topic.get(topic.id, []))
        await _upsert_topic_mastery(db, user_id, subject_id, topic, result)
        topic.mastery_score = result.mastery_score
        performance[str(topic.id)] = {
            "topic": topic.name,
            "mastery_score": result.mastery_score,
            "classification": result.classification,
        }
    await db.flush()
    return performance


class GapAnalysisService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def build_report(self, *, user_id: UUID, subject_id: UUID, attempt_id: UUID | None = None):
        return await build_gap_report(self.session, user_id, subject_id, attempt_id)
