from __future__ import annotations
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class ConversationMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    role: str
    text: str
    skill_call: dict[str, Any] | None
    at: datetime


class ConversationHistory(BaseModel):
    messages: list[ConversationMessageOut]


class ChatRequest(BaseModel):
    text: str
    scope: str = "global"
    scope_id: str | None = None
    current_screen: str = "홈"

