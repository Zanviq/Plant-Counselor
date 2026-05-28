"""FastAPI dependencies.

Auth is handled by Supabase (Google OAuth).
The Bearer token is a Supabase-signed JWT verified locally.
"""
from __future__ import annotations
from typing import Generator

from fastapi import Depends, Header, HTTPException, status
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models.user import User
from app.db.session import SessionLocal
from app.repositories.user_repo import UserRepository


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


_CREDS_EXC = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="인증에 실패했습니다.",
    headers={"WWW-Authenticate": "Bearer"},
)


def require_user(
    authorization: str | None = Header(None, alias="Authorization"),
    db: Session = Depends(get_db),
) -> User:
    """Verify Supabase JWT and return the user profile.

    If the profile doesn't exist yet (first API call after Google OAuth),
    it is created automatically from JWT claims as a fallback.
    The primary profile creation path is the Supabase DB trigger.
    """
    if not authorization:
        raise _CREDS_EXC

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise _CREDS_EXC

    if not settings.supabase_jwt_secret:
        raise HTTPException(
            status_code=503,
            detail="서버 설정 오류: SUPABASE_JWT_SECRET이 설정되지 않았습니다.",
        )

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except JWTError:
        raise _CREDS_EXC

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise _CREDS_EXC

    repo = UserRepository(db)
    user = repo.get_by_id(user_id)

    if user is None:
        # Fallback: create profile if DB trigger didn't fire yet
        email = payload.get("email") or ""
        meta = payload.get("user_metadata") or {}
        nickname = meta.get("full_name") or meta.get("name") or email.split("@")[0]
        user = repo.create_profile(user_id, email, nickname)
        db.commit()
        db.refresh(user)

    return user
