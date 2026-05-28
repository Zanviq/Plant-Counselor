from __future__ import annotations
from fastapi import APIRouter, Depends
from supabase import Client

from app.deps import get_db, require_user
from app.repositories.notification_repo import NotificationRepository

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(user=Depends(require_user), db: Client = Depends(get_db)):
    items = NotificationRepository(db).list_unread(user.id)
    data = [
        {"id": n.id, "kind": n.kind, "payload": n.payload, "created_at": n.created_at}
        for n in items
    ]
    return {"ok": True, "data": {"items": data}}


@router.post("/{notification_id}/ack")
def ack_notification(notification_id: str, user=Depends(require_user), db: Client = Depends(get_db)):
    ok = NotificationRepository(db).ack(user.id, notification_id)
    return {"ok": ok}
