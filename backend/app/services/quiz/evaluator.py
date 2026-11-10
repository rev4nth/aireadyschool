"""Quiz answer evaluation: MCQ exact match + short-answer semantic grading."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Document, DocumentChunk, Quiz, QuizAttempt, QuizQuestion, StudentAnswer
from app.schemas.quizzes import (
    AnswerResult,
    AnswerSubmission,
    QuizQuestionFull,
    QuizResultResponse,
    ShortAnswerEvalSchema,
)
from app.services.ai.llm_service import get_llm_service
from app.services.rag.citations import validate_citations
from app.services.rag.retrieval import RetrievedChunk, hybrid_retrieve

logger = logging.getLogger(__name__)


async def evaluate_attempt(
    db: AsyncSession,
    user_id: UUID,
    quiz: Quiz,
    attempt: QuizAttempt,
    answers: list[AnswerSubmission],
) -> QuizResultResponse:
    questions = {q.id: q for q in quiz.questions}
    answer_map = {a.question_id: a for a in answers}
    total_score = 0.0
    topic_perf: dict[str, dict[str, Any]] = {}
    results: list[AnswerResult] = []

    for question in sorted(questions.values(), key=lambda q: q.question_index):
        submission = answer_map.get(question.id)
        answer_text = (submission.answer_text if submission else "") or ""
        evaluation = await evaluate_answer(db, user_id, question, answer_text)
        score = float(evaluation["score"])
        total_score += score

        topic_key = str(question.topic_id) if question.topic_id else "general"
        bucket = topic_perf.setdefault(topic_key, {"attempted": 0, "score_sum": 0.0, "correct": 0})
        bucket["attempted"] += 1
        bucket["score_sum"] += score
        if evaluation.get("is_correct"):
            bucket["correct"] += 1

        db.add(
            StudentAnswer(
                attempt_id=attempt.id,
                question_id=question.id,
                user_id=user_id,
                answer_text=answer_text,
                is_correct=evaluation.get("is_correct"),
                score=score,
                classification=evaluation.get("classification"),
                evaluation=evaluation,
            )
        )
        results.append(
            AnswerResult(
                question_id=question.id,
                is_correct=evaluation.get("is_correct"),
                score=score,
                classification=evaluation.get("classification"),
                evaluation=evaluation,
                correct_answer=question.correct_answer,
                explanation=question.explanation,
            )
        )

    attempt.score = round(total_score, 2)
    attempt.max_score = float(len(questions) * 100)
    attempt.status = "submitted"
    attempt.submitted_at = datetime.now(timezone.utc)
    attempt.topic_performance = {
        k: {
            "attempted": v["attempted"],
            "avg_score": round(v["score_sum"] / max(v["attempted"], 1), 2),
            "correct": v["correct"],
        }
        for k, v in topic_perf.items()
    }
    quiz.status = "submitted"
    await db.flush()

    gap_report_id = None
    revision_plan_ids: list[UUID] = []
    attempt_id = attempt.id

    # Refresh mastery, auto-build gap report, and adapt active revision plans.
    # Use a savepoint so a diagnosis failure never blocks quiz submission.
    try:
        from app.services.gap_analysis.service import build_gap_report, refresh_mastery_for_subject
        from app.models import RevisionPlan
        from app.services.revision.planner import recalculate_revision_plan

        async with db.begin_nested():
            await refresh_mastery_for_subject(db, user_id, quiz.subject_id, attempt_id)
            gap_report = await build_gap_report(db, user_id, quiz.subject_id, attempt_id)
            gap_report_id = gap_report.id

            plan_rows = (
                await db.execute(
                    select(RevisionPlan).where(
                        RevisionPlan.user_id == user_id,
                        RevisionPlan.subject_id == quiz.subject_id,
                        RevisionPlan.status == "active",
                    )
                )
            ).scalars().all()
            for plan in plan_rows:
                plan.gap_report_id = gap_report.id
                updated = await recalculate_revision_plan(db, plan)
                revision_plan_ids.append(updated.id)
    except Exception:  # noqa: BLE001
        logger.exception("post_quiz_diagnosis_refresh_failed attempt=%s", attempt_id)

    max_score = attempt.max_score or float(len(questions) * 100)
    percentage = round(((attempt.score or 0.0) / max_score) * 100, 2) if max_score else 0.0
    full_questions = [
        QuizQuestionFull.model_validate(q)
        for q in sorted(questions.values(), key=lambda x: x.question_index)
    ]
    logger.info("quiz.evaluated attempt=%s score=%.2f", attempt.id, attempt.score or 0.0)
    return QuizResultResponse(
        attempt_id=attempt.id,
        quiz_id=quiz.id,
        score=attempt.score,
        max_score=attempt.max_score,
        percentage=percentage,
        status=attempt.status,
        topic_performance=attempt.topic_performance,
        answers=results,
        evaluations=results,
        questions=full_questions,
        gap_report_id=gap_report_id,
        revision_plan_ids=revision_plan_ids,
    )


async def evaluate_answer(
    db: AsyncSession,
    user_id: UUID,
    question: QuizQuestion,
    answer_text: str,
) -> dict[str, Any]:
    if (question.question_type or "").lower() == "mcq":
        expected = (question.correct_answer or "").strip().lower()
        given = (answer_text or "").strip().lower()
        is_correct = bool(given) and given == expected
        return {
            "score": 100.0 if is_correct else 0.0,
            "classification": "correct" if is_correct else "incorrect",
            "is_correct": is_correct,
            "misconceptions": [] if is_correct else ["Selected incorrect option"],
            "corrected_answer": question.correct_answer,
            "feedback": question.explanation,
            "citations": question.citations or [],
            "method": "exact_match",
        }

    retrieved = await _load_retrieved_chunks(db, user_id, question)
    context_bits = [
        f"[chunk_id={c.chunk_id}] {c.document_title} p.{c.page_number}: {c.content}"
        for c in retrieved
    ]
    context = "\n\n".join(context_bits) or (question.explanation or "")
    prompt = (
        "You are grading a student's short answer using ONLY the provided CONTEXT and "
        "the official correct answer. Do not invent facts.\n\n"
        f"QUESTION: {question.question_text}\n"
        f"OFFICIAL ANSWER: {question.correct_answer}\n"
        f"STUDENT ANSWER: {answer_text}\n\n"
        f"CONTEXT:\n{context}\n\n"
        "Return JSON with: score (0-100), classification "
        "(correct|partially_correct|incorrect), misconceptions (list), "
        "corrected_answer, feedback, citations (chunk_id only from CONTEXT)."
    )
    result = await get_llm_service().generate_structured(
        prompt, ShortAnswerEvalSchema, operation="short_answer_eval"
    )
    citations = validate_citations(result.citations, retrieved)
    citations_payload = (
        [c.model_dump(mode="json") for c in citations]
        if citations
        else (question.citations or [])
    )
    return {
        "score": float(result.score),
        "classification": result.classification,
        "is_correct": result.classification == "correct",
        "misconceptions": result.misconceptions,
        "corrected_answer": result.corrected_answer,
        "feedback": result.feedback,
        "citations": citations_payload,
        "method": "llm_semantic",
    }


async def _load_retrieved_chunks(
    db: AsyncSession,
    user_id: UUID,
    question: QuizQuestion,
) -> list[RetrievedChunk]:
    chunk_ids = list(question.retrieved_chunk_ids or [])
    if not chunk_ids:
        return await hybrid_retrieve(db, user_id=user_id, query=question.question_text, top_k=5)

    stmt = (
        select(
            DocumentChunk.id,
            DocumentChunk.document_id,
            DocumentChunk.subject_id,
            DocumentChunk.page_number,
            DocumentChunk.section_heading,
            DocumentChunk.content,
            Document.title,
        )
        .join(Document, Document.id == DocumentChunk.document_id)
        .where(DocumentChunk.user_id == user_id, DocumentChunk.id.in_(chunk_ids))
    )
    rows = (await db.execute(stmt)).all()
    return [
        RetrievedChunk(
            chunk_id=row.id,
            document_id=row.document_id,
            subject_id=row.subject_id,
            document_title=row.title or "Untitled",
            page_number=row.page_number,
            section_heading=row.section_heading,
            content=row.content,
            score=1.0,
        )
        for row in rows
    ]


class QuizEvaluator:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def evaluate_submission(self, user_id, quiz, attempt, answers):
        return await evaluate_attempt(self.session, user_id, quiz, attempt, answers)
