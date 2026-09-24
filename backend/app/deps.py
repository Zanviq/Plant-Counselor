"""FastAPI dependencies.

Auth: username + password (bcrypt) with a stateless session. On login the
server issues an HS256 JWT (`sub` = user id) inside an httpOnly cookie; every
authenticated request is verified here. See app/security.py and routers/auth.py.

Row-level security note: the database has no RLS. Every repository query that
reads or writes user data filters by `user_id` taken from `require_user`, and
admin endpoints additionally depend on `require_admin`. Former RLS policies that
now live in application code:
  - calendar_events_owner  (USING/WITH CHECK auth.uid() = user_id)
      → CalendarEventRepository always adds `user_id = <current user>`.
  - ai_logs (RLS enabled, no policies = no client access)
      → only admin routers read ai_logs; there is no public endpoint.
"""
from __future__ import annotations

from types import SimpleNamespace

from fastapi import Depends, HTTPException, Request, status

from app.config import settings
from app.db.pg import Client
from app.repositories.user_repo import UserRepository
from app.security import decode_session_token


def get_db() -> Client:
    """Return the shared PostgreSQL client."""
    from app.db.pg import get_client
    return get_client()


_CREDS_EXC = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="인증에 실패했습니다.",
)


def require_user(request: Request, db: Client = Depends(get_db)) -> SimpleNamespace:
    """Read the session cookie, verify it, and return the user row."""
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise _CREDS_EXC
    user_id = decode_session_token(token)
    if not user_id:
        raise _CREDS_EXC
    user = UserRepository(db).get_by_id(user_id)
    if user is None:
        raise _CREDS_EXC
    return user


_ADMIN_EXC = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail="관리자 권한이 필요합니다.",
)


def require_admin(user: SimpleNamespace = Depends(require_user)) -> SimpleNamespace:
    """require_user + admin role check. Returns the admin user or raises 403."""
    if getattr(user, "role", "user") != "admin":
        raise _ADMIN_EXC
    return user
