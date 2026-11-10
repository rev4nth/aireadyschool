"""JWT verification against Supabase Auth (ES256 JWKS + legacy HS256)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Any
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthenticatedUser:
    id: UUID
    email: str | None
    role: str
    raw_claims: dict[str, Any]


@lru_cache
def _jwks_client(supabase_url: str) -> PyJWKClient:
    return PyJWKClient(f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json")


def _unauthorized(detail: str = "Invalid or expired authentication token") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _decode_supabase_jwt(token: str, settings: Settings) -> dict[str, Any]:
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as exc:
        raise _unauthorized() from exc

    alg = str(header.get("alg") or "HS256")
    decode_kwargs: dict[str, Any] = {
        "algorithms": [alg],
        "audience": "authenticated",
        # Small leeway covers local/server clock skew (nbf/exp ImmatureSignatureError).
        "leeway": 60,
        "options": {
            "verify_signature": True,
            "verify_aud": True,
            "verify_exp": True,
            "require_exp": True,
        },
    }

    try:
        if alg in {"ES256", "RS256"}:
            key = _jwks_client(settings.supabase_url).get_signing_key_from_jwt(token).key
            claims = jwt.decode(token, key, **decode_kwargs)
        elif alg == "HS256":
            claims = jwt.decode(token, settings.supabase_jwt_secret, **decode_kwargs)
        else:
            raise _unauthorized(f"Unsupported token algorithm: {alg}")
    except HTTPException:
        raise
    except jwt.PyJWTError as exc:
        logger.info("JWT verification failed alg=%s error=%s", alg, type(exc).__name__)
        raise _unauthorized() from exc

    issuer = claims.get("iss")
    expected_issuer = f"{settings.supabase_url}/auth/v1"
    if issuer and issuer.rstrip("/") != expected_issuer.rstrip("/"):
        if "supabase" in str(issuer).lower() or settings.is_production:
            raise _unauthorized("Invalid token issuer")

    if not claims.get("sub"):
        raise _unauthorized("Token missing subject")

    return claims


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized("Authentication required")

    claims = _decode_supabase_jwt(credentials.credentials, settings)
    try:
        user_id = UUID(str(claims["sub"]))
    except (ValueError, KeyError) as exc:
        raise _unauthorized("Invalid user identity in token") from exc

    return AuthenticatedUser(
        id=user_id,
        email=claims.get("email"),
        role=str(claims.get("role", "authenticated")),
        raw_claims=claims,
    )


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser | None:
    if credentials is None:
        return None
    return await get_current_user(credentials, settings)
