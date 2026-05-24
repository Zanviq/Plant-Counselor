from __future__ import annotations
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class UserCreate(BaseModel):
    nickname: str
    password: str


class UserLogin(BaseModel):
    nickname: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    nickname: str
    address: str
    tone: str
    ai_model: str
    ai_proactive: bool
    garden_rules: dict[str, Any]
    appearance: dict[str, Any]
    sound: dict[str, Any]
    created_at: datetime


class UserUpdate(BaseModel):
    address: str | None = None
    tone: str | None = None
    ai_model: str | None = None
    ai_proactive: bool | None = None
    garden_rules: dict[str, Any] | None = None
    appearance: dict[str, Any] | None = None
    sound: dict[str, Any] | None = None


class PasswordChange(BaseModel):
    old_password: str
    new_password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ApiKeySet(BaseModel):
    api_key: str

