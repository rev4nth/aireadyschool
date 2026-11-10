"""API v1 router aggregation."""

from fastapi import APIRouter

from app.api.v1 import (
    analytics,
    assistant,
    auth,
    gap_reports,
    materials,
    profile,
    progress,
    quizzes,
    revision_plans,
    subjects,
    topics,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(profile.router, prefix="/profile", tags=["profile"])
api_router.include_router(subjects.router, prefix="/subjects", tags=["subjects"])
api_router.include_router(materials.router, prefix="/materials", tags=["materials"])
api_router.include_router(topics.router, prefix="/topics", tags=["topics"])
api_router.include_router(quizzes.router, prefix="/quizzes", tags=["quizzes"])
api_router.include_router(gap_reports.router, prefix="/gap-reports", tags=["gap-reports"])
api_router.include_router(revision_plans.router, prefix="/revision-plans", tags=["revision-plans"])
api_router.include_router(assistant.router, prefix="/assistant", tags=["assistant"])
api_router.include_router(progress.router, prefix="/progress", tags=["progress"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
