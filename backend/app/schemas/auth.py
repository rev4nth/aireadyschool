"""Auth-related request/response schemas."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=200)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class PasswordResetRequest(BaseModel):
    email: EmailStr


class AuthUserResponse(BaseModel):
    id: UUID
    email: EmailStr | None = None
    role: str = "authenticated"


class AuthSessionResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"
    expires_in: int | None = None
    user_id: str | None = None
    email: EmailStr | None = None
    user: AuthUserResponse | None = None


class AuthMessageResponse(BaseModel):
    message: str
    email: EmailStr | None = None
