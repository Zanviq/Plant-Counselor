from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.models.user import User
from app.deps import get_db, require_user
from app.schemas.user import ApiKeySet, UserOut, UserUpdate
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


@router.delete("")
def delete_account(
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Delete all user data. Sign out via Supabase on the frontend after this."""
    svc = UserService(db)
    svc.delete_account(user.id)
    return {"ok": True, "data": {}}


@router.put("/api-key")
def set_api_key(
    body: ApiKeySet,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    UserService(db).set_api_key(user.id, body.api_key)
    return {"ok": True, "data": {}}
