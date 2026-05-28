from __future__ import annotations
from datetime import datetime
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
            .maybe_single()
            .execute()
        )
        return _row(res.data)

    def list(
        self,
        user_id: str,
        include_dormant: bool = True,
        sort: str = "activity",
        limit: int = 100,
    ) -> list[SimpleNamespace]:
        q = self.db.table("plants").select("*").eq("user_id", user_id).neq("status", "archived")
        if not include_dormant:
            q = q.eq("status", "active")
        if sort == "activity":
            q = q.order("last_activity_at", desc=True, nulls_last=True).order("created_at", desc=True)
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

    def increment_stat(self, user_id: str, plant_id: str, stat_key: str) -> None:
        plant = self.get(user_id, plant_id)
        if plant is None:
            return
        stats = dict(plant.stats or {})
        stats[stat_key] = stats.get(stat_key, 0) + 1
        self.db.table("plants").update({
            "stats": stats,
            "last_activity_at": datetime.utcnow().isoformat(),
        }).eq("id", plant_id).eq("user_id", user_id).execute()

    def update_active_bud_count(self, user_id: str, plant_id: str, count: int) -> None:
        plant = self.get(user_id, plant_id)
        if plant is None:
            return
        stats = dict(plant.stats or {})
        stats["active_bud_count"] = count
        self.db.table("plants").update({"stats": stats}).eq("id", plant_id).eq("user_id", user_id).execute()

    def update_stats(self, user_id: str, plant_id: str, stats_update: dict) -> SimpleNamespace | None:
        plant = self.get(user_id, plant_id)
        if plant is None:
            return None
        stats = dict(plant.stats or {})
        stats.update(stats_update)
        res = self.db.table("plants").update({"stats": stats}).eq("id", plant_id).eq("user_id", user_id).execute()
        return _row(res.data[0]) if res.data else None
