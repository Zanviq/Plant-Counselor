from __future__ import annotations

from pydantic import BaseModel


class ChatRequest(BaseModel):
    text: str
    scope: str = "global"
    scope_id: str | None = None
    current_screen: str = "홈"

