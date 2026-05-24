from __future__ import annotations
from datetime import datetime, date

from pydantic import BaseModel, ConfigDict


class BudHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    bud_id: str
    from_status: str
    to_status: str
    at: datetime
    reason: str


class BudOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    plant_id: str
    title: str
    detail: str
    type: str
    status: str
    progress: int
    deadline: date | None
    last_progress_at: datetime | None
    disappeared_at: datetime | None
    created_at: datetime
    updated_at: datetime


class BudWithHistory(BaseModel):
    bud: BudOut
    history: list[BudHistoryOut]


class BudPatch(BaseModel):
    """제목/설명만 직접 수정 가능"""
    title: str | None = None
    detail: str | None = None


class BudListResponse(BaseModel):
    items: list[BudOut]
    next_cursor: str | None

