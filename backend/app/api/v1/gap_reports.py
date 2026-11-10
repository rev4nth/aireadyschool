from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import ensure_owner
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.core.security import AuthenticatedUser, get_current_user
from app.models import GapReport, Subject
from app.schemas.gap_reports import GapReportGenerateRequest, GapReportResponse

router = APIRouter()


@router.get("", response_model=list[GapReportResponse])
async def list_gap_reports(
    subject_id: UUID | None = None,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[GapReport]:
    query = select(GapReport).where(GapReport.user_id == user.id).order_by(GapReport.created_at.desc())
    if subject_id:
        query = query.where(GapReport.subject_id == subject_id)
    result = await db.execute(query)
    return list(result.scalars().all())


@router.post("/generate", response_model=GapReportResponse)
async def generate_gap_report(
    payload: GapReportGenerateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GapReport:
    subject = await db.get(Subject, payload.subject_id)
    if subject is None:
        raise NotFoundError("Subject not found")
    ensure_owner(subject.user_id, user)

    from app.services.gap_analysis.service import build_gap_report

    return await build_gap_report(db, user.id, payload.subject_id, payload.attempt_id)


@router.get("/{report_id}", response_model=GapReportResponse)
async def get_gap_report(
    report_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GapReport:
    report = await db.get(GapReport, report_id)
    if report is None:
        raise NotFoundError("Gap report not found")
    ensure_owner(report.user_id, user)
    return report
