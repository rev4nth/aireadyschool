"""Transparent mastery scoring algorithm."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal

from app.core.config import get_settings

MasteryClass = Literal["weak", "medium", "strong"]

DIFFICULTY_WEIGHTS = {
    "easy": 0.8,
    "medium": 1.0,
    "hard": 1.25,
}


@dataclass(frozen=True)
class AttemptSignal:
    score: float
    difficulty: str = "medium"
    answered_at: datetime | None = None
    is_correct: bool | None = None
    question_id: str | None = None
    answer_text: str | None = None
    classification: str | None = None
    misconception: str | None = None


@dataclass(frozen=True)
class MasteryResult:
    mastery_score: float
    classification: MasteryClass
    questions_attempted: int
    correct_count: int
    incorrect_count: int
    recent_score: float | None
    historical_avg: float | None
    confidence: float
    evidence: list[dict[str, Any]]
    formula: str


def classify_mastery(score: float) -> MasteryClass:
    settings = get_settings()
    if score < settings.mastery_weak_threshold:
        return "weak"
    if score < settings.mastery_strong_threshold:
        return "medium"
    return "strong"


def compute_mastery(
    signals: list[AttemptSignal],
    *,
    recent_window: int = 5,
    recent_weight: float = 0.65,
    historical_weight: float = 0.35,
) -> MasteryResult:
    """
    mastery = recent_weight * recent_score + historical_weight * historical_avg
    where each attempt score is difficulty-weighted, then clamped to 0–100.
    Thresholds come from settings.mastery_weak_threshold / mastery_strong_threshold.
    """
    if not signals:
        return MasteryResult(
            mastery_score=0.0,
            classification="weak",
            questions_attempted=0,
            correct_count=0,
            incorrect_count=0,
            recent_score=None,
            historical_avg=None,
            confidence=0.0,
            evidence=[],
            formula="mastery = 0.65*recent + 0.35*historical; empty history → 0 (weak)",
        )

    ordered = sorted(
        signals,
        key=lambda s: s.answered_at or datetime.min.replace(tzinfo=timezone.utc),
    )
    weighted: list[float] = []
    correct = incorrect = 0
    evidence: list[dict[str, Any]] = []

    for signal in ordered:
        score = max(0.0, min(100.0, float(signal.score)))
        weight = DIFFICULTY_WEIGHTS.get((signal.difficulty or "medium").lower(), 1.0)
        weighted_score = max(0.0, min(100.0, score * (0.85 + 0.15 * weight)))
        weighted.append(weighted_score)

        is_correct = signal.is_correct if signal.is_correct is not None else score >= 70
        if is_correct:
            correct += 1
        else:
            incorrect += 1

        if signal.answer_text is not None or signal.question_id is not None:
            evidence.append(
                {
                    "question_id": signal.question_id,
                    "answer_text": signal.answer_text,
                    "score": score,
                    "classification": signal.classification
                    or ("correct" if is_correct else "incorrect"),
                    "misconception": signal.misconception,
                    "difficulty": signal.difficulty,
                }
            )

    historical_avg = sum(weighted) / len(weighted)
    recent_slice = weighted[-recent_window:]
    recent_score = sum(recent_slice) / len(recent_slice)
    mastery = round(max(0.0, min(100.0, recent_weight * recent_score + historical_weight * historical_avg)), 2)
    confidence = round(1.0 - pow(2.718281828, -len(ordered) / 5.0), 4)

    return MasteryResult(
        mastery_score=mastery,
        classification=classify_mastery(mastery),
        questions_attempted=len(ordered),
        correct_count=correct,
        incorrect_count=incorrect,
        recent_score=round(recent_score, 2),
        historical_avg=round(historical_avg, 2),
        confidence=confidence,
        evidence=evidence[-20:],
        formula=(
            f"mastery = {recent_weight}*recent({recent_window}) + "
            f"{historical_weight}*historical; difficulty_weights={DIFFICULTY_WEIGHTS}"
        ),
    )
