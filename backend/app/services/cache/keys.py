"""Cache key builders for GapFinder AI."""

from __future__ import annotations

from uuid import UUID

from app.core.config import get_settings


def materials_user_pattern(user_id: UUID | str) -> str:
    return f"materials:{user_id}:*"


def materials_list_key(user_id: UUID | str, subject_id: UUID | str | None = None) -> str:
    subject_part = str(subject_id) if subject_id else "all"
    return f"materials:{user_id}:list:{subject_part}"


def material_detail_key(user_id: UUID | str, document_id: UUID | str) -> str:
    return f"materials:{user_id}:doc:{document_id}"


def quiz_cache_key(
    user_id: UUID | str,
    material_version: int | str,
    topic: str,
    difficulty: str,
    count: int,
    prompt_version: str | None = None,
) -> str:
    """quiz:{user}:{material_version}:{topic}:{difficulty}:{count}:{prompt_version}"""
    version = prompt_version or get_settings().prompt_version
    return (
        f"quiz:{user_id}:{material_version}:{_slug(topic)}:"
        f"{difficulty}:{count}:{version}"
    )


def retrieval_cache_key(
    user_id: str,
    subject_id: str,
    query_fingerprint: str,
    material_version: int | str,
) -> str:
    return f"retrieval:{user_id}:{subject_id}:{material_version}:{query_fingerprint}"


def topic_map_key(user_id: UUID | str, subject_id: UUID | str, material_version: int | str) -> str:
    return f"topics:{user_id}:{subject_id}:{material_version}"


def gap_report_key(user_id: UUID | str, subject_id: UUID | str, attempt_id: UUID | str | None) -> str:
    attempt_part = str(attempt_id) if attempt_id else "aggregate"
    return f"gap:{user_id}:{subject_id}:{attempt_part}"


def revision_plan_key(user_id: UUID | str, plan_id: UUID | str) -> str:
    return f"revision:{user_id}:{plan_id}"


def rag_answer_key(
    *,
    user_id: UUID | str,
    subject_id: UUID | str | None,
    question_fingerprint: str,
    prompt_version: str | None = None,
) -> str:
    version = prompt_version or get_settings().prompt_version
    subject_part = str(subject_id) if subject_id else "none"
    return f"rag:{user_id}:{subject_part}:{question_fingerprint}:{version}"


def _slug(value: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "-" for ch in (value or "").strip())
    while "--" in cleaned:
        cleaned = cleaned.replace("--", "-")
    return cleaned.strip("-") or "na"
