from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.models.user import User
from app.deps import get_db, require_user
from app.services.conversation_service import ConversationService

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("")
def get_history(
    scope: str = "global",
    scope_id: str | None = None,
    limit: int = 20,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    msgs = ConversationService(db).get_history(user.id, scope, scope_id, limit)
    data = [
        {"id": m.id, "role": m.role, "text": m.text, "at": m.at.isoformat()}
        for m in msgs
    ]
    return {"ok": True, "data": {"messages": data}}


@router.post("/search")
def search(
    body: dict,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    query = body.get("query", "")
    scope = body.get("scope", "global")
    scope_id = body.get("scope_id")
    limit = body.get("limit", 20)
    msgs = ConversationService(db).search(user.id, query, scope, scope_id, limit)
    data = [
        {"id": m.id, "role": m.role, "text": m.text, "at": m.at.isoformat()}
        for m in msgs
    ]
    return {"ok": True, "data": {"messages": data}}

