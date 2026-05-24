from __future__ import annotations
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class SkillRegistry:
    def __init__(self):
        self._skills: dict[str, SkillBase] = {}

    def register(self, skill: SkillBase):
        self._skills[skill.name] = skill

    def get(self, name: str) -> SkillBase | None:
        return self._skills.get(name)

    def list(self) -> list[SkillBase]:
        return list(self._skills.values())

    def build_catalog(self) -> list[dict]:
        return [s.to_tool_spec() for s in self._skills.values()]

    def dispatch(self, name: str, args: dict, ctx: SkillContext) -> SkillResult:
        skill = self.get(name)
        if skill is None:
            return SkillResult(
                ok=False,
                message=f"Skill '{name}' not found",
                error_code="not_found",
            )
        # 소유권 확인은 서비스 레이어에서 user_id 격리로 처리
        try:
            return skill.run(args, ctx)
        except Exception as e:
            return SkillResult(ok=False, message=str(e), error_code="internal")

