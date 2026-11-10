"""Adaptive revision planning from gap severity and exam importance."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundError
from app.models import GapReport, RevisionPlan, RevisionTask, Subject, Topic, TopicMastery
from app.schemas.revision import RevisionPlanCreate
from app.services.gap_analysis.scoring import classify_mastery

logger = logging.getLogger(__name__)

CLASS_SEVERITY = {"weak": 1.0, "medium": 0.55, "strong": 0.15}


def compute_priority(
    *,
    weakness_severity: float,
    exam_importance: float,
    past_paper_frequency: float,
) -> float:
    return round(float(weakness_severity) + float(exam_importance) + float(past_paper_frequency), 2)


async def generate_revision_plan(
    db: AsyncSession,
    user_id: UUID,
    request: RevisionPlanCreate,
) -> RevisionPlan:
    subject = await db.get(Subject, request.subject_id)
    if subject is None or subject.user_id != user_id:
        raise NotFoundError("Subject not found")

    gap_report = None
    if request.gap_report_id:
        gap_report = await db.get(GapReport, request.gap_report_id)
        if gap_report is None or gap_report.user_id != user_id:
            raise NotFoundError("Gap report not found")

    topics = await _load_topic_inputs(db, user_id, request.subject_id, gap_report)
    available_minutes = int(request.available_days * request.hours_per_day * 60)
    tasks_spec = _allocate_tasks(topics, available_minutes)

    plan = RevisionPlan(
        user_id=user_id,
        subject_id=subject.id,
        gap_report_id=request.gap_report_id,
        title=request.title or f"{subject.name} revision plan",
        exam_date=request.exam_date or subject.exam_date,
        available_days=request.available_days,
        hours_per_day=request.hours_per_day,
        preferences=request.preferences or {},
        status="active",
    )
    db.add(plan)
    await db.flush()
    for spec in tasks_spec:
        db.add(_task_from_spec(plan.id, user_id, spec))
    await db.flush()
    logger.info("revision.plan_created id=%s tasks=%s", plan.id, len(tasks_spec))
    return plan


async def recalculate_revision_plan(db: AsyncSession, plan: RevisionPlan) -> RevisionPlan:
    result = await db.execute(
        select(RevisionPlan)
        .where(RevisionPlan.id == plan.id)
        .options(selectinload(RevisionPlan.tasks))
    )
    plan = result.scalar_one()

    completed_tasks = [t for t in plan.tasks if t.completion_status == "completed"]
    for task in list(plan.tasks):
        if task.completion_status != "completed":
            await db.delete(task)
    await db.flush()

    plan.change_reason = "Adaptive recalculation from updated mastery"
    plan.updated_at = datetime.now(timezone.utc)

    days = int(plan.available_days or 7)
    hours = float(plan.hours_per_day or 2.0)
    completed_minutes = sum(t.duration_minutes for t in completed_tasks)
    available_minutes = max(0, int(days * hours * 60) - completed_minutes)

    gap_report = await db.get(GapReport, plan.gap_report_id) if plan.gap_report_id else None
    topics = await _load_topic_inputs(db, plan.user_id, plan.subject_id, gap_report)
    completed_topic_ids = {t.topic_id for t in completed_tasks if t.topic_id}
    topics = [t for t in topics if t["topic_id"] not in completed_topic_ids]

    new_specs = _allocate_tasks(topics, available_minutes)
    day_offset = 0
    if completed_tasks and days > 0:
        day_offset = min(days - 1, completed_minutes // max(int(hours * 60), 1))

    for spec in new_specs:
        if spec.get("scheduled_day") is not None:
            spec["scheduled_day"] = min(days, spec["scheduled_day"] + day_offset)
        db.add(_task_from_spec(plan.id, plan.user_id, spec))

    await db.flush()
    await db.refresh(plan, attribute_names=["tasks"])
    logger.info(
        "revision.recalculated id=%s preserved=%s new_tasks=%s",
        plan.id,
        len(completed_tasks),
        len(new_specs),
    )
    return plan


def _task_from_spec(plan_id: UUID, user_id: UUID, spec: dict[str, Any]) -> RevisionTask:
    return RevisionTask(
        plan_id=plan_id,
        user_id=user_id,
        topic_id=spec["topic_id"],
        title=spec["title"],
        priority=spec["priority"],
        duration_minutes=spec["duration_minutes"],
        activity=spec["activity"],
        source_material=spec.get("source_material", []),
        practice_questions=spec.get("practice_questions", []),
        completion_status="pending",
        target_mastery=spec.get("target_mastery"),
        prioritization_reason=spec.get("prioritization_reason"),
        scheduled_day=spec.get("scheduled_day"),
    )


def _allocate_tasks(topics: list[dict[str, Any]], available_minutes: int) -> list[dict[str, Any]]:
    if not topics or available_minutes <= 0:
        return []
    ranked = sorted(topics, key=lambda t: t["priority"], reverse=True)
    total_priority = sum(max(t["priority"], 0.01) for t in ranked) or 1.0
    specs: list[dict[str, Any]] = []
    remaining = available_minutes
    day = 1
    for topic in ranked:
        if remaining < 15:
            break
        duration = int(round(available_minutes * (topic["priority"] / total_priority)))
        duration = max(20, min(duration, remaining, 120))
        remaining -= duration
        classification = topic["classification"]
        activity = (
            "Concept review + worked examples + 5 practice questions"
            if classification == "weak"
            else (
                "Targeted practice set + error log review"
                if classification == "medium"
                else "Spaced recall quiz + light summary notes"
            )
        )
        specs.append(
            {
                "topic_id": topic["topic_id"],
                "title": f"Revise: {topic['name']}",
                "priority": topic["priority"],
                "duration_minutes": duration,
                "activity": activity,
                "target_mastery": 75.0 if classification != "strong" else 90.0,
                "prioritization_reason": (
                    f"priority={topic['priority']:.1f} "
                    f"(weakness={topic['weakness_severity']:.1f} + "
                    f"exam_importance={topic['exam_importance']:.1f} + "
                    f"past_paper_frequency={topic['past_paper_frequency']:.1f})"
                ),
                "scheduled_day": day,
                "source_material": topic.get("source_sections", []),
                "practice_questions": [],
            }
        )
        if duration >= 45:
            day += 1
    return specs


async def _load_topic_inputs(
    db: AsyncSession,
    user_id: UUID,
    subject_id: UUID,
    gap_report: GapReport | None,
) -> list[dict[str, Any]]:
    topics = list(
        (
            await db.execute(
                select(Topic).where(Topic.user_id == user_id, Topic.subject_id == subject_id)
            )
        )
        .scalars()
        .all()
    )
    mastery_rows = list(
        (
            await db.execute(
                select(TopicMastery).where(
                    TopicMastery.user_id == user_id,
                    TopicMastery.subject_id == subject_id,
                )
            )
        )
        .scalars()
        .all()
    )
    mastery_by_topic = {m.topic_id: m for m in mastery_rows}
    gap_by_topic: dict[str, dict[str, Any]] = {}
    if gap_report and gap_report.topics:
        for item in gap_report.topics:
            if isinstance(item, dict) and item.get("topic_id"):
                gap_by_topic[str(item["topic_id"])] = item

    results: list[dict[str, Any]] = []
    for topic in topics:
        mastery = mastery_by_topic.get(topic.id)
        gap_item = gap_by_topic.get(str(topic.id), {})
        classification = (
            gap_item.get("classification")
            or (mastery.classification if mastery else None)
            or classify_mastery(float(topic.mastery_score or 0.0))
        )
        severity = CLASS_SEVERITY.get(classification, 0.55) * 100.0
        score = (
            gap_item.get("mastery_score")
            if gap_item.get("mastery_score") is not None
            else (mastery.mastery_score if mastery else topic.mastery_score)
        )
        weakness_severity = max(severity, 100.0 - float(score or 0.0))
        exam_importance = float(topic.exam_importance or 50.0)
        past_freq = min(float(topic.past_paper_frequency or 0) * 5.0, 100.0)
        results.append(
            {
                "topic_id": topic.id,
                "name": topic.name,
                "classification": classification,
                "weakness_severity": weakness_severity,
                "exam_importance": exam_importance,
                "past_paper_frequency": past_freq,
                "priority": compute_priority(
                    weakness_severity=weakness_severity,
                    exam_importance=exam_importance,
                    past_paper_frequency=past_freq,
                ),
                "source_sections": topic.source_sections or [],
            }
        )
    return results


class RevisionPlanner:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_plan(self, user_id: UUID, request: RevisionPlanCreate) -> RevisionPlan:
        return await generate_revision_plan(self.session, user_id, request)

    async def recalculate(self, plan: RevisionPlan) -> RevisionPlan:
        return await recalculate_revision_plan(self.session, plan)
