"""FastAPI dependencies.

Single home for shared dependencies: DB session + authenticated user.
Token creation/decoding lives in `app.auth.jwt` — do not duplicate it here.
"""
from __future__ import annotations
from typing import Generator

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.jwt import decode_token
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
    """Resolve the access-token Bearer header into a User. 401 on any failure."""
    if not authorization:
        raise _CREDS_EXC

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise _CREDS_EXC

    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise _CREDS_EXC
    user_id = payload.get("sub")
    if not user_id:
        raise _CREDS_EXC

    user = UserRepository(db).get_by_id(user_id)
    if user is None:
        raise _CREDS_EXC
    return user
