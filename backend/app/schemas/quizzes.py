"""Quiz generation and evaluation schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import CitationSchema, ORMModel

QuizMode = Literal["subject", "topic", "weak_topics", "custom"]
Difficulty = Literal["easy", "medium", "hard", "mixed"]
QuestionType = Literal["mcq", "short_answer", "conceptual", "application"]
AnswerClassification = Literal["correct", "partially_correct", "incorrect"]


class QuizGenerateRequest(BaseModel):
    subject_id: UUID
    title: str | None = Field(default=None, max_length=300)
    quiz_mode: QuizMode = "topic"
    topic_ids: list[UUID] = Field(default_factory=list)
    difficulty: Difficulty = "mixed"
    question_count: int = Field(default=5, ge=1, le=40)
    question_types: list[QuestionType] = Field(default_factory=lambda: ["mcq", "short_answer"])
    time_limit_seconds: int | None = Field(default=None, ge=30)


class GeneratedQuestion(BaseModel):
    question_type: QuestionType
    question_text: str
    options: list[str] | None = None
    correct_answer: str
    explanation: str | None = None
    difficulty: Difficulty = "medium"
    topic_name: str | None = None
    citations: list[CitationSchema] = Field(default_factory=list)
    retrieved_chunk_ids: list[UUID] = Field(default_factory=list)


class QuizGenerateLLMSchema(BaseModel):
    questions: list[GeneratedQuestion] = Field(min_length=1)


class QuizQuestionPublic(ORMModel):
    id: UUID
    quiz_id: UUID
    topic_id: UUID | None = None
    question_index: int
    question_type: str
    question_text: str
    options: list[Any] | None = None
    difficulty: str
    citations: list[Any] = Field(default_factory=list)


class QuizQuestionFull(QuizQuestionPublic):
    correct_answer: str
    explanation: str | None = None
    retrieved_chunk_ids: list[UUID] = Field(default_factory=list)


class QuizResponse(ORMModel):
    id: UUID
    user_id: UUID
    subject_id: UUID
    title: str
    quiz_mode: str
    difficulty: str
    question_count: int
    time_limit_seconds: int | None = None
    status: str
    metadata: dict[str, Any] = Field(default_factory=dict, validation_alias="metadata_")
    questions: list[QuizQuestionPublic] = Field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None


class QuizStartResponse(BaseModel):
    attempt_id: UUID
    quiz: QuizResponse


class AnswerSubmission(BaseModel):
    question_id: UUID
    answer_text: str = Field(default="", max_length=5000)


class QuizSubmitRequest(BaseModel):
    attempt_id: UUID
    answers: list[AnswerSubmission] = Field(min_length=1)


class ShortAnswerEvalSchema(BaseModel):
    score: float = Field(ge=0, le=100)
    classification: AnswerClassification
    misconceptions: list[str] = Field(default_factory=list)
    corrected_answer: str
    feedback: str | None = None
    citations: list[CitationSchema] = Field(default_factory=list)


class AnswerResult(BaseModel):
    question_id: UUID
    is_correct: bool | None = None
    score: float | None = None
    classification: AnswerClassification | None = None
    evaluation: dict[str, Any] = Field(default_factory=dict)
    correct_answer: str | None = None
    explanation: str | None = None


class QuizResultResponse(BaseModel):
    attempt_id: UUID
    quiz_id: UUID
    score: float | None = None
    max_score: float | None = None
    percentage: float | None = None
    status: str
    topic_performance: dict[str, Any] = Field(default_factory=dict)
    answers: list[AnswerResult] = Field(default_factory=list)
    evaluations: list[AnswerResult] = Field(default_factory=list)
    questions: list[QuizQuestionFull] = Field(default_factory=list)
