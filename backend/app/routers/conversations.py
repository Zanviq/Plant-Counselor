from __future__ import annotations
from fastapi import APIRouter, Depends
from supabase import Client

from app.deps import get_db, require_user
from app.services.conversation_service import ConversationService

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("/list")
def list_conversations(user=Depends(require_user), db: Client = Depends(get_db)):
    items = ConversationService(db).list_conversations(user.id)
    return {"ok": True, "data": {"conversations": items}}


@router.get("")
def get_history(scope: str = "global", scope_id: str | None = None, limit: int = 20,
                user=Depends(require_user), db: Client = Depends(get_db)):
    msgs = ConversationService(db).get_history(user.id, scope, scope_id, limit)
    data = [{"id": m.id, "role": m.role, "text": m.text, "at": m.at} for m in msgs]
    return {"ok": True, "data": {"messages": data}}


@router.delete("")
def delete_conversation(scope: str = "global", scope_id: str | None = None,
                        user=Depends(require_user), db: Client = Depends(get_db)):
    """Permanently delete the current user's conversation for this scope
    (and all of its messages via CASCADE)."""
    deleted = ConversationService(db).delete_conversation(user.id, scope, scope_id)
    return {"ok": True, "data": {"deleted": deleted}}


@router.post("/search")
def search(body: dict, user=Depends(require_user), db: Client = Depends(get_db)):
    query = body.get("query", "")
    scope = body.get("scope", "global")
    scope_id = body.get("scope_id")
    limit = body.get("limit", 20)
    msgs = ConversationService(db).search(user.id, query, scope, scope_id, limit)
    data = [{"id": m.id, "role": m.role, "text": m.text, "at": m.at} for m in msgs]
    return {"ok": True, "data": {"messages": data}}
