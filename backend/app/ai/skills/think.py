from __future__ import annotations
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class ThinkSkill(SkillBase):
    name = "think"
    description = (
        "복잡한 작업 전에 사고 과정을 정리하는 스킬. "
        "실제 데이터를 변경하지 않으며, 작업 계획 수립에만 사용합니다. "
        "여러 스킬을 순서대로 실행해야 할 때 먼저 호출하여 계획을 수립하세요."
    )
    parameters = {
        "type": "object",
        "properties": {
            "reasoning": {
                "type": "string",
                "description": "수행할 작업의 계획과 이유를 자세히 서술",
            }
        },
        "required": ["reasoning"],
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        return SkillResult(
            ok=True,
            message="사고 완료",
            data={"reasoning": args.get("reasoning", "")},
        )
