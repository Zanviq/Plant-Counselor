from __future__ import annotations
from datetime import date, timedelta
from types import SimpleNamespace

from supabase import Client
from ulid import ULID

import app.runtime_settings as rs


def _row(d: dict | None) -> SimpleNamespace | None:
    return SimpleNamespace(**d) if d else None


def _rows(lst: list[dict]) -> list[SimpleNamespace]:
    return [SimpleNamespace(**d) for d in lst]


class BudRepository:
    def __init__(self, db: Client) -> None:
        self.db = db

    def create(
        self,
        user_id: str,
        plant_id: str,
        title: str,
        type: str = "concern",
        detail: str = "",
        deadline: date | None = None,
    ) -> SimpleNamespace:
        row: dict = {
            "id": str(ULID()),
            "user_id": user_id,
            "plant_id": plant_id,
            "title": title,
            "type": type,
            "detail": detail,
        }
        if deadline is not None:
            row["deadline"] = deadline.isoformat()
        res = self.db.table("buds").insert(row).execute()
        return _row(res.data[0])

    def get(self, user_id: str, bud_id: str) -> SimpleNamespace | None:
        res = (
            self.db.table("buds")
            .select("*")
            .eq("id", bud_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return _row(res.data[0]) if res.data else None

    def list(
        self,
        user_id: str,
        plant_id: str | None = None,
        statuses: list[str] | None = None,
        bud_type: str | None = None,
        wilting_only: bool = False,
        deadline_within_days: int | None = None,
        limit: int = 50,
    ) -> list[SimpleNamespace]:
        q = self.db.table("buds").select("*").eq("user_id", user_id)
        if plant_id is not None:
            q = q.eq("plant_id", plant_id)
        if statuses is not None:
            q = q.in_("status", statuses)
        if bud_type is not None:
            q = q.eq("type", bud_type)
        if wilting_only:
            q = q.eq("status", "wilting")
        if deadline_within_days is not None:
            cutoff = (rs.today() + timedelta(days=deadline_within_days)).isoformat()
            q = q.lte("deadline", cutoff).not_.is_("deadline", "null")
        q = q.order("created_at", desc=True).limit(limit)
        res = q.execute()
        return _rows(res.data or [])

    def update(self, user_id: str, bud_id: str, fields: dict) -> SimpleNamespace | None:
        # convert date → isoformat for JSON
        safe = {}
        for k, v in fields.items():
            safe[k] = v.isoformat() if isinstance(v, date) else v
        res = (
            self.db.table("buds")
            .update(safe)
            .eq("id", bud_id)
            .eq("user_id", user_id)
            .execute()
        )
        return _row(res.data[0]) if res.data else None

    def add_history(
        self,
        bud_id: str,
        from_status: str,
        to_status: str,
        reason: str = "",
    ) -> SimpleNamespace:
        row = {
            "id": str(ULID()),
            "bud_id": bud_id,
            "from_status": from_status,
            "to_status": to_status,
            "at": rs.now().isoformat(),
            "reason": reason,
        }
        res = self.db.table("bud_history").insert(row).execute()
        return _row(res.data[0])

    def get_history(self, bud_id: str) -> list[SimpleNamespace]:
        res = (
            self.db.table("bud_history")
            .select("*")
            .eq("bud_id", bud_id)
            .order("at", desc=False)
            .execute()
        )
        return _rows(res.data or [])

    def count_active(self, plant_id: str) -> int:
        inactive = ["harvested", "rot"]
        res = (
            self.db.table("buds")
            .select("id", count="exact")
            .eq("plant_id", plant_id)
            .not_.in_("status", inactive)
            .is_("disappeared_at", "null")
            .execute()
        )
        return res.count or 0
