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

