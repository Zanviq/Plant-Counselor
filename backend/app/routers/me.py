from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.models.user import User
from app.deps import get_db, require_user
from app.schemas.user import ApiKeySet, PasswordChange, UserOut, UserUpdate
from app.services.user_service import UserService

router = APIRouter(prefix="/me", tags=["me"])


@router.get("")
def get_me(user: User = Depends(require_user)):
    return {"ok": True, "data": UserOut.model_validate(user)}


@router.patch("")
def update_me(
    body: UserUpdate,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    svc = UserService(db)
    updated = svc.update_profile(user.id, body.model_dump(exclude_none=True))
    return {"ok": True, "data": UserOut.model_validate(updated)}


@router.post("/password")
def change_password(
    body: PasswordChange,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    svc = UserService(db)
    ok = svc.change_password(user.id, body.old_password, body.new_password)
    if not ok:
        raise HTTPException(status_code=400, detail="비밀번호 변경 실패")
    return {"ok": True, "data": {}}


@router.delete("")
def delete_account(
    body: dict,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    confirm = body.get("confirm_nickname", "")
    svc = UserService(db)
    ok = svc.delete_account(user.id, confirm)
    if not ok:
        raise HTTPException(status_code=400, detail="계정 삭제 실패")
    return {"ok": True, "data": {}}


@router.put("/api-key")
def set_api_key(
    body: ApiKeySet,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    UserService(db).set_api_key(user.id, body.api_key)
    return {"ok": True, "data": {}}

