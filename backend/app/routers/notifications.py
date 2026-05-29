from __future__ import annotations
from fastapi import APIRouter, Depends
from supabase import Client

from app.deps import get_db, require_user
from app.repositories.notification_repo import NotificationRepository

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(
    include_read: bool = False,
    limit: int = 50,
    user=Depends(require_user),
    db: Client = Depends(get_db),
):
    """List notifications.

    Default (include_read=false) → unread only, for the bell badge count.
    include_read=true → full history (read + unread), newest first.
    """
    repo = NotificationRepository(db)
    items = repo.list_all(user.id, limit) if include_read else repo.list_unread(user.id)
    data = [
        {
            "id": n.id,
            "kind": n.kind,
            "payload": n.payload,
            "created_at": n.created_at,
            "acked_at": getattr(n, "acked_at", None),
        }
        for n in items
    ]
    return {"ok": True, "data": {"items": data}}


@router.post("/{notification_id}/ack")
def ack_notification(notification_id: str, user=Depends(require_user), db: Client = Depends(get_db)):
    ok = NotificationRepository(db).ack(user.id, notification_id)
    return {"ok": ok}


@router.post("/ack-all")
def ack_all_notifications(user=Depends(require_user), db: Client = Depends(get_db)):
    """Mark all unread notifications as read in a single request."""
    count = NotificationRepository(db).ack_all(user.id)
    return {"ok": True, "data": {"acked": count}}
