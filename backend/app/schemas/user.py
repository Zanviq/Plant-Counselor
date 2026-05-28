from __future__ import annotations
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str | None = None
    nickname: str | None = None
    tone: str
    ai_model: str
    garden_rules: dict[str, Any]
    appearance: dict[str, Any]
    created_at: datetime


class UserUpdate(BaseModel):
    nickname: str | None = None
    tone: str | None = None
    ai_model: str | None = None
    garden_rules: dict[str, Any] | None = None
    appearance: dict[str, Any] | None = None


class ApiKeySet(BaseModel):
    api_key: str
