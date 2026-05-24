from __future__ import annotations
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class AbandonBudSkill(SkillBase):
    name = "abandon_bud"
    description = (
        "봉우리(고민/일정)를 포기 처리합니다. "
        "사용자가 해당 고민이나 일정을 그만두겠다고 명확히 밝혔을 때 호출하세요."
    )
    parameters = {
        "type": "object",
        "properties": {
            "bud_id": {"type": "string", "description": "포기할 봉우리 ID"},
            "reason": {"type": "string", "description": "포기 이유"},
        },
        "required": ["bud_id"],
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        ctx.bud_service.abandon(
            ctx.user_id, args["bud_id"], args.get("reason", "user:포기")
        )
        return SkillResult(ok=True, message="봉우리를 포기 처리했습니다.", data={})
