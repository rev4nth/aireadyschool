from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException
from jose import jwt

from app.core.config import get_settings
from app.core.security import _decode_supabase_jwt


def _token(sub: str | None = None, expired: bool = False, aud: str = "authenticated") -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub or str(uuid4()),
        "aud": aud,
        "role": "authenticated",
        "email": "student@example.com",
        "iss": f"{settings.supabase_url}/auth/v1",
        "exp": int((now + timedelta(hours=-1 if expired else 1)).timestamp()),
    }
    return jwt.encode(payload, settings.supabase_jwt_secret, algorithm="HS256")


def test_jwt_valid():
    token = _token()
    claims = _decode_supabase_jwt(token, get_settings())
    assert claims["email"] == "student@example.com"


def test_jwt_expired_rejected():
    token = _token(expired=True)
    with pytest.raises(HTTPException) as exc:
        _decode_supabase_jwt(token, get_settings())
    assert exc.value.status_code == 401


def test_jwt_wrong_audience_rejected():
    token = _token(aud="anon")
    with pytest.raises(HTTPException):
        _decode_supabase_jwt(token, get_settings())


def test_ensure_owner_idor_guard():
    from app.api.deps import ensure_owner
    from app.core.exceptions import ForbiddenError
    from app.core.security import AuthenticatedUser

    user = AuthenticatedUser(id=uuid4(), email="a@b.c", role="authenticated", raw_claims={})
    with pytest.raises(ForbiddenError):
        ensure_owner(uuid4(), user)
