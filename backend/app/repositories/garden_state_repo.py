from __future__ import annotations
from types import SimpleNamespace

from app.db.pg import Client
from ulid import ULID


def _row(d: dict | None) -> SimpleNamespace | None:
    return SimpleNamespace(**d) if d else None


class GardenStateRepository:
    def __init__(self, db: Client) -> None:
        self.db = db

    def get_or_create(self, user_id: str) -> SimpleNamespace:
        res = self.db.table("garden_state").select("*").eq("user_id", user_id).limit(1).execute()
        if res.data:
            return _row(res.data[0])
        # Concurrent first requests (e.g. /stats/summary + /briefing/today) can both
        # get here; ON CONFLICT DO NOTHING keeps the unique(user_id) row single.
        row = {"id": str(ULID()), "user_id": user_id}
        self.db.table("garden_state").upsert(row, on_conflict="user_id", ignore_duplicates=True).execute()
        res = self.db.table("garden_state").select("*").eq("user_id", user_id).limit(1).execute()
        return _row(res.data[0])

    def update(self, user_id: str, fields: dict) -> SimpleNamespace:
        state = self.get_or_create(user_id)
        res = self.db.table("garden_state").update(fields).eq("id", state.id).execute()
        return _row(res.data[0]) if res.data else state
