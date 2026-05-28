from __future__ import annotations
from datetime import datetime
from types import SimpleNamespace

from supabase import Client
from ulid import ULID


def _row(d: dict | None) -> SimpleNamespace | None:
    return SimpleNamespace(**d) if d else None


def _rows(lst: list[dict]) -> list[SimpleNamespace]:
    return [SimpleNamespace(**d) for d in lst]


class NotificationRepository:
    def __init__(self, db: Client) -> None:
        self.db = db

    def push(self, user_id: str, kind: str, payload: dict) -> SimpleNamespace:
        row = {"id": str(ULID()), "user_id": user_id, "kind": kind, "payload": payload}
        res = self.db.table("notifications").insert(row).execute()
        return _row(res.data[0])

    def list_unread(self, user_id: str) -> list[SimpleNamespace]:
        res = (
            self.db.table("notifications")
            .select("*")
            .eq("user_id", user_id)
            .is_("acked_at", "null")
            .order("created_at", desc=False)
            .execute()
        )
        return _rows(res.data or [])

    def ack(self, user_id: str, notification_id: str) -> bool:
        res = (
            self.db.table("notifications")
            .update({"acked_at": datetime.utcnow().isoformat()})
            .eq("id", notification_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(res.data)
