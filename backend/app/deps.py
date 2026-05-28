"""FastAPI dependencies.

Auth is handled by Supabase (Google OAuth).
The Bearer token is a Supabase-signed JWT verified via JWKS (ES256).
"""
from __future__ import annotations

import json
import logging
import urllib.request
from types import SimpleNamespace

from fastapi import Depends, Header, HTTPException, status
from jose import jwt, JWTError
from supabase import Client

from app.config import settings
from app.repositories.user_repo import UserRepository

logger = logging.getLogger(__name__)

# ── JWKS cache ────────────────────────────────────────────────────────────────
_jwks_cache: dict | None = None


def _load_jwks() -> dict | None:
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache
    try:
        url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
        with urllib.request.urlopen(url, timeout=10) as resp:
            _jwks_cache = json.loads(resp.read())
            algs = [k.get("alg") for k in _jwks_cache.get("keys", [])]
            logger.info("Supabase JWKS loaded: %d key(s), alg=%s", len(_jwks_cache.get("keys", [])), algs)
            return _jwks_cache
    except Exception as exc:
        logger.warning("Could not fetch Supabase JWKS: %s", exc)
        return None


def get_db() -> Client:
    """Return the shared Supabase PostgREST client."""
    from app.db.supa import get_client
    return get_client()


_CREDS_EXC = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="인증에 실패했습니다.",
    headers={"WWW-Authenticate": "Bearer"},
)


def require_user(
    authorization: str | None = Header(None, alias="Authorization"),
    db: Client = Depends(get_db),
) -> SimpleNamespace:
    """Verify Supabase JWT (ES256 via JWKS, fallback HS256) and return profile."""
    if not authorization:
        raise _CREDS_EXC

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise _CREDS_EXC

    payload: dict | None = None

    jwks = _load_jwks()
    if jwks:
        try:
            payload = jwt.decode(token, jwks, algorithms=["ES256", "RS256"], audience="authenticated")
        except JWTError:
            pass

    if payload is None and settings.supabase_jwt_secret:
        try:
            payload = jwt.decode(token, settings.supabase_jwt_secret, algorithms=["HS256"], audience="authenticated")
        except JWTError:
            pass

    if payload is None:
        raise _CREDS_EXC

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise _CREDS_EXC

    repo = UserRepository(db)
    user = repo.get_by_id(user_id)

    if user is None:
        email = payload.get("email") or ""
        meta = payload.get("user_metadata") or {}
        nickname = meta.get("full_name") or meta.get("name") or email.split("@")[0]
        user = repo.create_profile(user_id, email, nickname)

    return user
