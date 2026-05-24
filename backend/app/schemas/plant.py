from __future__ import annotations
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class PlantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    name: str
    description: str
    species: str
    color: str
    status: str
    stats: dict[str, Any]
    last_activity_at: datetime | None
    created_at: datetime
    updated_at: datetime


class PlantUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    species: str | None = None
    color: str | None = None


class PlantListResponse(BaseModel):
    items: list[PlantOut]
    next_cursor: str | None

