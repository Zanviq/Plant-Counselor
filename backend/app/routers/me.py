from __future__ import annotations
from fastapi import APIRouter, Depends, Response
from app.db.pg import Client

from app.deps import get_db, require_user
from app.schemas.user import UserOut, UserUpdate
from app.security import clear_session_cookie
from app.services.user_service import UserService

router = APIRouter(prefix="/me", tags=["me"])


@router.get("")
def get_me(user=Depends(require_user)):
    return {"ok": True, "data": UserOut.model_validate(user)}


@router.patch("")
def update_me(body: UserUpdate, user=Depends(require_user), db: Client = Depends(get_db)):
    updated = UserService(db).update_profile(user.id, body.model_dump(exclude_none=True))
    return {"ok": True, "data": UserOut.model_validate(updated)}


@router.delete("")
def delete_account(response: Response, user=Depends(require_user), db: Client = Depends(get_db)):
    deleted = UserService(db).delete_account(user.id)
    clear_session_cookie(response)
    return {"ok": True, "data": {"deleted": deleted}}

