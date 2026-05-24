from __future__ import annotations
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session
from ulid import ULID

from app.db.models.notification import Notification


class NotificationRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def push(self, user_id: str, kind: str, payload: dict) -> Notification:
        notif = Notification(
            id=str(ULID()),
            user_id=user_id,
            kind=kind,
            payload=payload,
        )
        self.db.add(notif)
        self.db.flush()
        return notif

    def list_unread(self, user_id: str) -> list[Notification]:
        stmt = (
            select(Notification)
            .where(Notification.user_id == user_id, Notification.acked_at.is_(None))
            .order_by(Notification.created_at.asc())
        )
        return list(self.db.scalars(stmt).all())

    def ack(self, user_id: str, notification_id: str) -> bool:
        stmt = select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
        notif = self.db.scalar(stmt)
        if notif is None:
            return False
        notif.acked_at = datetime.utcnow()
        self.db.flush()
        return True

