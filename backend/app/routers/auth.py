from __future__ import annotations
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.auth.jwt import create_access_token, create_refresh_token, decode_token
from app.deps import get_db
from app.repositories.user_repo import UserRepository
from app.schemas.user import UserCreate, UserLogin, UserOut
from app.services.user_service import UserService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup")
def signup(body: UserCreate, db: Session = Depends(get_db)):
    svc = UserService(db)
    try:
        svc.signup(body.nickname, body.password)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return {"ok": True, "data": {"message": "가입 완료. 로그인해주세요."}}


@router.post("/login")
def login(body: UserLogin, response: Response, db: Session = Depends(get_db)):
    svc = UserService(db)
    user = svc.authenticate(body.nickname, body.password)
    if user is None:
        raise HTTPException(
            status_code=401, detail="닉네임 또는 비밀번호가 맞지 않습니다."
        )
    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)
    response.set_cookie(
        "refresh_token",
        refresh,
        httponly=True,
        samesite="lax",
        max_age=14 * 86400,
        path="/",
    )
    return {
        "ok": True,
        "data": {
            "access_token": access,
            "token_type": "bearer",
            "user": UserOut.model_validate(user),
        },
    }


@router.post("/refresh")
def refresh_token(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")
    payload = decode_token(refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user = UserRepository(db).get_by_id(payload["sub"])
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    new_access = create_access_token(user.id)
    return {"ok": True, "data": {"access_token": new_access, "token_type": "bearer"}}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True, "data": {}}

