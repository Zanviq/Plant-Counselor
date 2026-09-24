"""Username + password authentication.

POST /auth/signup   create an account and start a session
POST /auth/login    verify credentials and start a session
POST /auth/logout   clear the session cookie
GET  /auth/me       current user (401 when not signed in)

The session is an HS256 JWT stored in an httpOnly, SameSite=Lax cookie, so
browser JavaScript never sees it. Passwords are hashed with bcrypt.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.db.pg import Client
from app.deps import get_db, require_user
from app.repositories.user_repo import UserRepository
from app.schemas.user import LoginRequest, SignupRequest, UserOut
from app.security import clear_session_cookie, hash_password, set_session_cookie, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

_LOGIN_FAILED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="아이디 또는 비밀번호가 올바르지 않습니다.",
)


@router.post("/signup")
def signup(body: SignupRequest, response: Response, db: Client = Depends(get_db)):
    repo = UserRepository(db)
    username = body.username.strip().lower()
    if repo.username_exists(username):
        raise HTTPException(status.HTTP_409_CONFLICT, "이미 사용 중인 아이디입니다.")
    nickname = (body.nickname or "").strip() or username
    email = (body.email or "").strip() or None
    user = repo.create(username, hash_password(body.password), nickname, email)
    set_session_cookie(response, user.id)
    return {"ok": True, "data": UserOut.model_validate(user)}


@router.post("/login")
def login(body: LoginRequest, response: Response, db: Client = Depends(get_db)):
    repo = UserRepository(db)
    creds = repo.get_credentials(body.username.strip().lower())
    if creds is None or not verify_password(body.password, creds.get("password_hash")):
        raise _LOGIN_FAILED
    user = repo.get_by_id(creds["id"])
    if user is None:
        raise _LOGIN_FAILED
    set_session_cookie(response, user.id)
    return {"ok": True, "data": UserOut.model_validate(user)}


@router.post("/logout")
def logout(response: Response):
    clear_session_cookie(response)
    return {"ok": True, "data": {}}


@router.get("/me")
def me(user=Depends(require_user)):
    return {"ok": True, "data": UserOut.model_validate(user)}
