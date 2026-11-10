"""Pydantic request/response schemas."""

from app.schemas.assistant import ChatRequest, ChatResponse, ChatSessionResponse
from app.schemas.auth import (
    AuthMessageResponse,
    AuthSessionResponse,
    LoginRequest,
    PasswordResetRequest,
    RegisterRequest,
)
from app.schemas.common import CitationSchema, ErrorResponse, MessageResponse
from app.schemas.gap_reports import GapReportGenerateRequest, GapReportResponse
from app.schemas.materials import (
    MaterialCreateText,
    MaterialListResponse,
    MaterialResponse,
    ProcessStatusResponse,
)
from app.schemas.profile import ProfileResponse, ProfileUpdate
from app.schemas.progress import AnalyticsResponse, DashboardResponse, ProgressOverview
from app.schemas.quizzes import (
    QuizGenerateRequest,
    QuizResponse,
    QuizResultResponse,
    QuizStartResponse,
    QuizSubmitRequest,
)
from app.schemas.revision import (
    RevisionPlanCreate,
    RevisionPlanResponse,
    RevisionTaskResponse,
    RevisionTaskUpdate,
)
from app.schemas.subjects import SubjectCreate, SubjectResponse, SubjectUpdate
from app.schemas.topics import TopicMapGenerateRequest, TopicMapResponse, TopicResponse

__all__ = [
    "CitationSchema",
    "ErrorResponse",
    "MessageResponse",
    "AuthMessageResponse",
    "AuthSessionResponse",
    "LoginRequest",
    "PasswordResetRequest",
    "RegisterRequest",
    "ProfileResponse",
    "ProfileUpdate",
    "SubjectCreate",
    "SubjectResponse",
    "SubjectUpdate",
    "MaterialCreateText",
    "MaterialListResponse",
    "MaterialResponse",
    "ProcessStatusResponse",
    "TopicMapGenerateRequest",
    "TopicMapResponse",
    "TopicResponse",
    "QuizGenerateRequest",
    "QuizResponse",
    "QuizResultResponse",
    "QuizStartResponse",
    "QuizSubmitRequest",
    "GapReportGenerateRequest",
    "GapReportResponse",
    "RevisionPlanCreate",
    "RevisionPlanResponse",
    "RevisionTaskResponse",
    "RevisionTaskUpdate",
    "ChatRequest",
    "ChatResponse",
    "ChatSessionResponse",
    "AnalyticsResponse",
    "DashboardResponse",
    "ProgressOverview",
]
