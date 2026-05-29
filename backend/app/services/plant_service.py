from __future__ import annotations
from types import SimpleNamespace

from supabase import Client

from app.repositories.plant_repo import PlantRepository, _rows


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
        # Escape LIKE wildcards so user input doesn't match unintended patterns.
        safe = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        res = (
            self.db.table("plants")
            .select("*")
            .eq("user_id", user_id)
            .neq("status", "archived")
            .ilike("name", f"%{safe}%")
            .limit(top_k)
            .execute()
        )
        return _rows(res.data or [])
