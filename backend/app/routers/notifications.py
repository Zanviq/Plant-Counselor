from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.models.user import User
from app.deps import get_db, require_user
from app.repositories.notification_repo import NotificationRepository

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    items = NotificationRepository(db).list_unread(user.id)
    data = [
        {
            "id": n.id,
            "kind": n.kind,
            "payload": n.payload,
            "created_at": n.created_at.isoformat(),
        }
        for n in items
    ]
    return {"ok": True, "data": {"items": data}}


@router.post("/{notification_id}/ack")
def ack_notification(
    notification_id: str,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    ok = NotificationRepository(db).ack(user.id, notification_id)
    db.commit()
    return {"ok": ok}

