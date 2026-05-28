from __future__ import annotations
from types import SimpleNamespace

from supabase import Client
from ulid import ULID


def _row(d: dict | None) -> SimpleNamespace | None:
    return SimpleNamespace(**d) if d else None


class GardenStateRepository:
    def __init__(self, db: Client) -> None:
        self.db = db

    def get_or_create(self, user_id: str) -> SimpleNamespace:
        res = self.db.table("garden_state").select("*").eq("user_id", user_id).maybe_single().execute()
        if res.data:
            return _row(res.data)
        row = {"id": str(ULID()), "user_id": user_id}
        ins = self.db.table("garden_state").insert(row).execute()
        return _row(ins.data[0])

    def update(self, user_id: str, fields: dict) -> SimpleNamespace:
        state = self.get_or_create(user_id)
        res = self.db.table("garden_state").update(fields).eq("id", state.id).execute()
        return _row(res.data[0]) if res.data else state
