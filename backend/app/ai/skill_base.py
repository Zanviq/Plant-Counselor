from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class SkillResult:
    ok: bool
    message: str
    data: dict = field(default_factory=dict)
    error_code: str = ""


@dataclass
class SkillContext:
    user_id: str
    db: Any
    plant_service: Any = None
    bud_service: Any = None
    garden_state_service: Any = None
    conversation_service: Any = None
    calendar_service: Any = None
    # Current chat session scope — drives per-session edit/delete permissions.
    scope: str = "global"          # global | plant | bud | calendar
    scope_id: str | None = None    # plant_id (plant scope) or bud_id (bud scope)


class SkillBase(ABC):
    name: str = ""
    description: str = ""
    parameters: dict = {}

    @abstractmethod
    def run(self, args: dict, ctx: SkillContext) -> SkillResult: ...

    def to_tool_spec(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.parameters,
        }

