from __future__ import annotations
from types import SimpleNamespace

from supabase import Client
from ulid import ULID


def _row(d: dict | None) -> SimpleNamespace | None:
    return SimpleNamespace(**d) if d else None


def _rows(lst: list[dict]) -> list[SimpleNamespace]:
    return [SimpleNamespace(**d) for d in lst]


class PlantRepository:
    def __init__(self, db: Client) -> None:
        self.db = db

    def create(
        self,
        user_id: str,
        name: str,
        description: str = "",
        species: str = "tree_oak",
        color: str = "brand.primary_leaf",
    ) -> SimpleNamespace:
        row = {
            "id": str(ULID()),
            "user_id": user_id,
            "name": name,
            "description": description,
            "species": species,
            "color": color,
        }
        res = self.db.table("plants").insert(row).execute()
        return _row(res.data[0])

    def get(self, user_id: str, plant_id: str) -> SimpleNamespace | None:
        res = (
            self.db.table("plants")
            .select("*")
            .eq("id", plant_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return _row(res.data[0]) if res.data else None

    def list(
        self,
        user_id: str,
        include_dormant: bool = True,
        sort: str = "activity",
        limit: int = 100,
    ) -> list[SimpleNamespace]:
        q = self.db.table("plants").select("*").eq("user_id", user_id).neq("status", "archived")
        if not include_dormant:
            # Keep wilted plants visible (they still render, in brown) — only hide
            # dormant/archived plants from the default garden view.
            q = q.in_("status", ["active", "wilting"])
        if sort == "activity":
            q = q.order("last_activity_at", desc=True, nullsfirst=False).order("created_at", desc=True)
        else:
            q = q.order("created_at", desc=True)
        q = q.limit(limit)
        res = q.execute()
        return _rows(res.data or [])

    def update(self, user_id: str, plant_id: str, fields: dict) -> SimpleNamespace | None:
        res = (
            self.db.table("plants")
            .update(fields)
            .eq("id", plant_id)
            .eq("user_id", user_id)
            .execute()
        )
        return _row(res.data[0]) if res.data else None
