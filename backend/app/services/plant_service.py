from __future__ import annotations
from types import SimpleNamespace

from supabase import Client

from app.repositories.plant_repo import PlantRepository
from app.repositories.bud_repo import BudRepository


_ACTIVE_STATUSES = {"seed", "bud", "flower", "fruit", "wilting"}


class PlantService:
    def __init__(self, db: Client) -> None:
        self.db = db
        self._repo = PlantRepository(db)

    def create(self, user_id: str, name: str, description: str = "",
               species: str = "tree_oak", color: str = "brand.primary_leaf") -> SimpleNamespace:
        return self._repo.create(user_id, name, description, species, color)

    def get(self, user_id: str, plant_id: str) -> SimpleNamespace:
        plant = self._repo.get(user_id, plant_id)
        if plant is None:
            raise ValueError(f"식물을 찾을 수 없습니다: {plant_id}")
        return plant

    def list(self, user_id: str, include_dormant: bool = True, sort: str = "activity") -> list[SimpleNamespace]:
        return self._repo.list(user_id, include_dormant=include_dormant, sort=sort)

    def update(self, user_id: str, plant_id: str, fields: dict) -> SimpleNamespace:
        plant = self._repo.update(user_id, plant_id, fields)
        if plant is None:
            raise ValueError(f"식물을 찾을 수 없습니다: {plant_id}")
        return plant

    def delete(self, user_id: str, plant_id: str, archive: bool = True) -> None:
        if archive:
            self._repo.update(user_id, plant_id, {"status": "archived"})
        else:
            self.db.table("plants").delete().eq("id", plant_id).eq("user_id", user_id).execute()

    def find_matches(self, user_id: str, query: str, top_k: int = 3) -> list[SimpleNamespace]:
        # Search by name only (PostgREST doesn't support OR filtering easily)
        res = (
            self.db.table("plants")
            .select("*")
            .eq("user_id", user_id)
            .neq("status", "archived")
            .ilike("name", f"%{query}%")
            .limit(top_k)
            .execute()
        )
        from app.repositories.plant_repo import _rows
        return _rows(res.data or [])

    def increment_harvest(self, user_id: str, plant_id: str) -> None:
        self._repo.increment_stat(user_id, plant_id, "harvested_count")

    def increment_rot(self, user_id: str, plant_id: str) -> None:
        self._repo.increment_stat(user_id, plant_id, "rot_count")

    def mark_dormant(self, user_id: str, plant_id: str) -> None:
        plant = self._repo.update(user_id, plant_id, {"status": "dormant"})
        if plant is None:
            raise ValueError(f"식물을 찾을 수 없습니다: {plant_id}")

    def update_stats(self, user_id: str, plant_id: str, stats_update: dict) -> SimpleNamespace:
        plant = self._repo.update_stats(user_id, plant_id, stats_update)
        if plant is None:
            raise ValueError(f"식물을 찾을 수 없습니다: {plant_id}")
        return plant

    def refresh_active_bud_count(self, user_id: str, plant_id: str) -> None:
        count = BudRepository(self.db).count_active(plant_id)
        self._repo.update_active_bud_count(user_id, plant_id, count)
