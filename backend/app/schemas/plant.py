from __future__ import annotations
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, model_validator


class PlantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    name: str
    description: str = ""
    species: str = "tree_oak"
    color: str = "brand.primary_leaf"
    status: str = "active"
    stats: dict[str, Any] = {}
    last_activity_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def _build_stats(cls, v: Any) -> Any:
        # Convert SimpleNamespace → dict for processing
        if hasattr(v, "__dict__") and not isinstance(v, dict):
            v = vars(v)
        if not isinstance(v, dict):
            return v
        if not v.get("stats"):
            v = dict(v)
            abc = v.get("active_bud_count", 0)
            # active_bud_count might be {} (jsonb default) or a number
            if not isinstance(abc, (int, float)):
                abc = 0
            v["stats"] = {
                "harvested_count": int(v.get("harvested_count") or 0),
                "rot_count": int(v.get("rot_count") or 0),
                "active_bud_count": int(abc or 0),
            }
        return v


class PlantUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    species: str | None = None
    color: str | None = None


class PlantListResponse(BaseModel):
    items: list[PlantOut]
    next_cursor: str | None
