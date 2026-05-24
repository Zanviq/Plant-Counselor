from __future__ import annotations
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class GetGardenBriefingSkill(SkillBase):
    name = "get_garden_briefing"
    description = "오늘의 정원 상태 브리핑을 생성합니다."
    parameters = {
        "type": "object",
        "properties": {},
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        briefing = ctx.garden_state_service.build_briefing(ctx.user_id)
        return SkillResult(
            ok=True,
            message="브리핑 생성 완료",
            data={"briefing": briefing},
        )

