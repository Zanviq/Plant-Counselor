from __future__ import annotations
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, model_validator


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str | None = None
    nickname: str | None = None
    role: str = "user"
    tone: str = "counselor"
    ai_model: str = "gemini-2.5-flash"
    garden_rules: dict[str, Any] = {}
    appearance: dict[str, Any] = {}
    created_at: datetime

    @model_validator(mode="before")
    @classmethod
    def _coerce_nulls(cls, v: Any) -> Any:
        # DB rows may have NULL for jsonb/text columns. Coerce to defaults
        # so model_validate doesn't fail on `None` for non-Optional fields.
        if hasattr(v, "__dict__") and not isinstance(v, dict):
            v = vars(v)
        if isinstance(v, dict):
            v = dict(v)
            if v.get("tone") is None:           v["tone"] = "counselor"
            if v.get("ai_model") is None:       v["ai_model"] = "gemini-2.5-flash"
            if v.get("garden_rules") is None:   v["garden_rules"] = {}
            if v.get("appearance") is None:     v["appearance"] = {}
            if v.get("role") is None:           v["role"] = "user"
        return v


class UserUpdate(BaseModel):
    nickname: str | None = None
    tone: str | None = None
    ai_model: str | None = None
    garden_rules: dict[str, Any] | None = None
    appearance: dict[str, Any] | None = None


class ApiKeySet(BaseModel):
    api_key: str
