"""Authentication endpoints proxied through Supabase Auth."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request
from supabase import Client, create_client

from app.core.config import Settings, get_settings
from app.core.exceptions import AppError, RateLimitError
from app.core.redis import rate_limit
from app.core.security import AuthenticatedUser, get_current_user
from app.schemas.auth import (
    AuthMessageResponse,
    AuthSessionResponse,
    LoginRequest,
    PasswordResetRequest,
    RegisterRequest,
)
from app.schemas.common import MessageResponse

logger = logging.getLogger(__name__)
router = APIRouter()


def get_supabase_anon(settings: Settings = Depends(get_settings)) -> Client:
    return create_client(settings.supabase_url, settings.supabase_anon_key)


@router.post("/register", response_model=AuthMessageResponse)
async def register(
    payload: RegisterRequest,
    request: Request,
    settings: Settings = Depends(get_settings),
    supabase: Client = Depends(get_supabase_anon),
) -> AuthMessageResponse:
    ip = request.client.host if request.client else "unknown"
    allowed = await rate_limit(f"rl:register:{ip}", min(10, settings.rate_limit_per_minute), 60)
    if not allowed:
        raise RateLimitError("Too many registration attempts")

    try:
        result = supabase.auth.sign_up(
            {
                "email": payload.email,
                "password": payload.password,
                "options": {
                    "data": {"full_name": payload.full_name},
                    "email_redirect_to": f"{settings.frontend_url}/auth/verify",
                },
            }
        )
    except Exception as exc:  # noqa: BLE001
        logger.info("Registration failed for email domain=%s", payload.email.split("@")[-1])
        raise AppError("Unable to register with the provided credentials", status_code=400) from exc

    if result.user is None:
        raise AppError("Registration failed", status_code=400)

    return AuthMessageResponse(
        message="Registration successful. Please verify your email if required by your project settings."
    )


@router.post("/login", response_model=AuthSessionResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    settings: Settings = Depends(get_settings),
    supabase: Client = Depends(get_supabase_anon),
) -> AuthSessionResponse:
    ip = request.client.host if request.client else "unknown"
    allowed = await rate_limit(f"rl:login:{ip}", min(20, settings.rate_limit_per_minute), 60)
    if not allowed:
        raise RateLimitError("Too many login attempts")

    try:
        result = supabase.auth.sign_in_with_password(
            {"email": payload.email, "password": payload.password}
        )
    except Exception as exc:  # noqa: BLE001
        raise AppError("Invalid email or password", status_code=401) from exc

    session = result.session
    user = result.user
    if session is None or user is None:
        raise AppError("Invalid email or password", status_code=401)

    return AuthSessionResponse(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        expires_in=session.expires_in,
        user_id=str(user.id),
        email=user.email,
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    user: AuthenticatedUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_anon),
) -> MessageResponse:
    try:
        supabase.auth.sign_out()
    except Exception:  # noqa: BLE001
        logger.info("Logout completed locally for user=%s", user.id)
    return MessageResponse(message="Logged out")


@router.post("/forgot-password", response_model=AuthMessageResponse)
async def forgot_password(
    payload: PasswordResetRequest,
    request: Request,
    settings: Settings = Depends(get_settings),
    supabase: Client = Depends(get_supabase_anon),
) -> AuthMessageResponse:
    ip = request.client.host if request.client else "unknown"
    allowed = await rate_limit(f"rl:forgot:{ip}", 10, 60)
    if not allowed:
        raise RateLimitError()

    redirect_to = f"{settings.frontend_url}/auth/reset-password"
    try:
        supabase.auth.reset_password_email(payload.email, {"redirect_to": redirect_to})
    except Exception:  # noqa: BLE001
        # Do not leak whether the email exists.
        pass
    return AuthMessageResponse(
        message="If an account exists for that email, a reset link has been sent."
    )


@router.get("/me")
async def me(user: AuthenticatedUser = Depends(get_current_user)) -> dict:
    return {"id": str(user.id), "email": user.email, "role": user.role}
