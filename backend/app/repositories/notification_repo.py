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

    def has_unacked(self, user_id: str, kind: str, bud_id: str) -> bool:
        """True if an unread notification of this kind already exists for the bud.
        Used to avoid re-pushing the same deadline warning every scan."""
        res = (
            self.db.table("notifications")
            .select("id")
            .eq("user_id", user_id)
            .eq("kind", kind)
            .is_("acked_at", "null")
            .contains("payload", {"bud_id": bud_id})
            .limit(1)
            .execute()
        )
        return bool(res.data)

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

    def list_all(self, user_id: str, limit: int = 100) -> list[SimpleNamespace]:
        """All notifications (read + unread), newest first — for the history view."""
        res = (
            self.db.table("notifications")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
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

    def ack_all(self, user_id: str) -> int:
        """Mark every unread notification for this user as read. Returns count."""
        res = (
            self.db.table("notifications")
            .update({"acked_at": datetime.utcnow().isoformat()})
            .eq("user_id", user_id)
            .is_("acked_at", "null")
            .execute()
        )
        return len(res.data or [])
