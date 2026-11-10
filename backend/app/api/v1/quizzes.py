from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import ensure_owner
from app.core.database import get_db
from app.core.exceptions import AppError, NotFoundError
from app.core.security import AuthenticatedUser, get_current_user
from app.models import Quiz, QuizAttempt, QuizQuestion, Subject
from app.schemas.quizzes import (
    QuizGenerateRequest,
    QuizQuestionFull,
    QuizQuestionPublic,
    QuizResponse,
    QuizResultResponse,
    QuizStartResponse,
    QuizSubmitRequest,
)

router = APIRouter()


def _quiz_public(quiz: Quiz) -> QuizResponse:
    questions = [
        QuizQuestionPublic.model_validate(q)
        for q in sorted(quiz.questions, key=lambda x: x.question_index)
    ]
    return QuizResponse.model_validate(quiz).model_copy(update={"questions": questions})


@router.get("", response_model=list[QuizResponse])
async def list_quizzes(
    subject_id: UUID | None = None,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[QuizResponse]:
    query = (
        select(Quiz)
        .where(Quiz.user_id == user.id)
        .options(selectinload(Quiz.questions))
        .order_by(Quiz.created_at.desc())
    )
    if subject_id:
        query = query.where(Quiz.subject_id == subject_id)
    result = await db.execute(query)
    return [_quiz_public(q) for q in result.scalars().unique().all()]


@router.post("/generate", response_model=QuizResponse)
async def generate_quiz(
    payload: QuizGenerateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> QuizResponse:
    subject = await db.get(Subject, payload.subject_id)
    if subject is None:
        raise NotFoundError("Subject not found")
    ensure_owner(subject.user_id, user)

    from app.services.quiz.generator import generate_quiz as gen

    quiz = await gen(db, user.id, payload)
    await db.refresh(quiz, attribute_names=["questions"])
    return _quiz_public(quiz)


@router.get("/{quiz_id}", response_model=QuizResponse)
async def get_quiz(
    quiz_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> QuizResponse:
    result = await db.execute(
        select(Quiz).where(Quiz.id == quiz_id).options(selectinload(Quiz.questions))
    )
    quiz = result.scalar_one_or_none()
    if quiz is None:
        raise NotFoundError("Quiz not found")
    ensure_owner(quiz.user_id, user)
    return _quiz_public(quiz)


@router.post("/{quiz_id}/start", response_model=QuizStartResponse)
async def start_quiz(
    quiz_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> QuizStartResponse:
    result = await db.execute(
        select(Quiz).where(Quiz.id == quiz_id).options(selectinload(Quiz.questions))
    )
    quiz = result.scalar_one_or_none()
    if quiz is None:
        raise NotFoundError("Quiz not found")
    ensure_owner(quiz.user_id, user)
    if quiz.status == "failed":
        raise AppError("Quiz generation failed; regenerate before starting", status_code=400)

    attempt = QuizAttempt(
        quiz_id=quiz.id,
        user_id=user.id,
        status="in_progress",
        max_score=float(len(quiz.questions) * 100),
        topic_performance={},
    )
    quiz.status = "in_progress"
    db.add(attempt)
    await db.flush()
    await db.refresh(quiz)
    return QuizStartResponse(attempt_id=attempt.id, quiz=_quiz_public(quiz))


@router.post("/{quiz_id}/submit", response_model=QuizResultResponse)
async def submit_quiz(
    quiz_id: UUID,
    payload: QuizSubmitRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> QuizResultResponse:
    result = await db.execute(
        select(Quiz).where(Quiz.id == quiz_id).options(selectinload(Quiz.questions))
    )
    quiz = result.scalar_one_or_none()
    if quiz is None:
        raise NotFoundError("Quiz not found")
    ensure_owner(quiz.user_id, user)

    attempt = await db.get(QuizAttempt, payload.attempt_id)
    if attempt is None or attempt.quiz_id != quiz_id:
        raise NotFoundError("Attempt not found")
    ensure_owner(attempt.user_id, user)
    if attempt.status == "submitted":
        raise AppError("Attempt already submitted", status_code=400)

    from app.services.quiz.evaluator import evaluate_attempt

    result_payload = await evaluate_attempt(db, user.id, quiz, attempt, payload.answers)
    return result_payload
