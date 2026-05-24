from __future__ import annotations
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models.bud import Bud
from app.db.models.plant import Plant
from app.repositories.plant_repo import PlantRepository


_ACTIVE_STATUSES = {"seed", "bud", "flower", "fruit", "wilting"}


class PlantService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._repo = PlantRepository(db)

    def create(
        self,
        user_id: str,
        name: str,
        description: str = "",
        species: str = "tree_oak",
        color: str = "brand.primary_leaf",
    ) -> Plant:
        plant = self._repo.create(user_id, name, description, species, color)
        self.db.commit()
        self.db.refresh(plant)
        return plant

    def get(self, user_id: str, plant_id: str) -> Plant:
        plant = self._repo.get(user_id, plant_id)
        if plant is None:
            raise ValueError(f"식물을 찾을 수 없습니다: {plant_id}")
        return plant

    def list(
        self,
        user_id: str,
        include_dormant: bool = True,
        sort: str = "activity",
    ) -> list[Plant]:
        return self._repo.list(user_id, include_dormant=include_dormant, sort=sort)

    def update(self, user_id: str, plant_id: str, fields: dict) -> Plant:
        plant = self._repo.update(user_id, plant_id, fields)
        if plant is None:
            raise ValueError(f"식물을 찾을 수 없습니다: {plant_id}")
        self.db.commit()
        self.db.refresh(plant)
        return plant

    def delete(self, user_id: str, plant_id: str, archive: bool = True) -> None:
        plant = self.get(user_id, plant_id)
        if archive:
            plant.status = "archived"
            self.db.flush()
        else:
            self.db.delete(plant)
        self.db.commit()

    def find_matches(self, user_id: str, query: str, top_k: int = 3) -> list[Plant]:
        from sqlalchemy import or_
        pattern = f"%{query}%"
        stmt = (
            select(Plant)
            .where(
                Plant.user_id == user_id,
                Plant.status != "archived",
                or_(Plant.name.like(pattern), Plant.description.like(pattern)),
            )
            .limit(top_k)
        )
        return list(self.db.scalars(stmt).all())

    def increment_harvest(self, user_id: str, plant_id: str) -> None:
        self._repo.increment_stat(user_id, plant_id, "harvested_count")
        self.db.commit()

    def increment_rot(self, user_id: str, plant_id: str) -> None:
        self._repo.increment_stat(user_id, plant_id, "rot_count")
        self.db.commit()

    def mark_dormant(self, user_id: str, plant_id: str) -> None:
        plant = self._repo.update(user_id, plant_id, {"status": "dormant"})
        if plant is None:
            raise ValueError(f"식물을 찾을 수 없습니다: {plant_id}")
        self.db.commit()

    def update_stats(self, user_id: str, plant_id: str, stats_update: dict) -> Plant:
        plant = self._repo.update_stats(user_id, plant_id, stats_update)
        if plant is None:
            raise ValueError(f"식물을 찾을 수 없습니다: {plant_id}")
        self.db.commit()
        return plant

    def refresh_active_bud_count(self, user_id: str, plant_id: str) -> None:
        stmt = (
            select(func.count())
            .select_from(Bud)
            .where(
                Bud.plant_id == plant_id,
                Bud.user_id == user_id,
                Bud.status.in_(list(_ACTIVE_STATUSES)),
            )
        )
        count = self.db.scalar(stmt) or 0
        self._repo.update_active_bud_count(user_id, plant_id, count)
        self.db.commit()

