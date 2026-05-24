from __future__ import annotations
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session
from ulid import ULID

from app.db.models.plant import Plant


class PlantRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        user_id: str,
        name: str,
        description: str = "",
        species: str = "tree_oak",
        color: str = "brand.primary_leaf",
    ) -> Plant:
        plant = Plant(
            id=str(ULID()),
            user_id=user_id,
            name=name,
            description=description,
            species=species,
            color=color,
        )
        self.db.add(plant)
        self.db.flush()
        return plant

    def get(self, user_id: str, plant_id: str) -> Plant | None:
        stmt = select(Plant).where(Plant.id == plant_id, Plant.user_id == user_id)
        return self.db.scalar(stmt)

    def list(
        self,
        user_id: str,
        include_dormant: bool = True,
        sort: str = "activity",
        limit: int = 100,
    ) -> list[Plant]:
        stmt = select(Plant).where(Plant.user_id == user_id, Plant.status != "archived")
        if not include_dormant:
            stmt = stmt.where(Plant.status == "active")
        if sort == "activity":
            stmt = stmt.order_by(Plant.last_activity_at.desc().nulls_last(), Plant.created_at.desc())
        else:
            stmt = stmt.order_by(Plant.created_at.desc())
        stmt = stmt.limit(limit)
        return list(self.db.scalars(stmt).all())

    def update(self, user_id: str, plant_id: str, fields: dict) -> Plant | None:
        plant = self.get(user_id, plant_id)
        if plant is None:
            return None
        for key, value in fields.items():
            setattr(plant, key, value)
        self.db.flush()
        return plant

    def increment_stat(self, user_id: str, plant_id: str, stat_key: str) -> None:
        plant = self.get(user_id, plant_id)
        if plant is None:
            return
        stats = dict(plant.stats or {})
        stats[stat_key] = stats.get(stat_key, 0) + 1
        plant.stats = stats
        plant.last_activity_at = datetime.utcnow()
        self.db.flush()

    def update_active_bud_count(self, user_id: str, plant_id: str, count: int) -> None:
        plant = self.get(user_id, plant_id)
        if plant is None:
            return
        stats = dict(plant.stats or {})
        stats["active_bud_count"] = count
        plant.stats = stats
        self.db.flush()

    def update_stats(self, user_id: str, plant_id: str, stats_update: dict) -> Plant | None:
        plant = self.get(user_id, plant_id)
        if plant is None:
            return None
        stats = dict(plant.stats or {})
        stats.update(stats_update)
        plant.stats = stats
        self.db.flush()
        return plant

