from __future__ import annotations
from datetime import datetime, date

from pydantic import BaseModel, ConfigDict


class BudHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    bud_id: str
    from_status: str = ""
    to_status: str
    at: datetime
    reason: str = ""


class BudOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    plant_id: str
    title: str
    detail: str | None = None
    type: str
    status: str
    progress: int = 0
    deadline: date | None = None
    last_progress_at: datetime | None = None
    disappeared_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class BudPatch(BaseModel):
    title: str | None = None
    detail: str | None = None


class BudProgressUpdate(BaseModel):
    progress: int            # 0–100 (clamped server-side)
    note: str = ""           # optional reason ("왜 변경했는지") for history/AI
