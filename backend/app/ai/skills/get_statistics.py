from __future__ import annotations
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class GetStatisticsSkill(SkillBase):
    name = "get_statistics"
    description = "정원 통계를 조회합니다."
    parameters = {
        "type": "object",
        "properties": {
            "scope": {"type": "string"},
            "plant_id": {"type": "string"},
            "period": {"type": "string"},
        },
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        stats = ctx.garden_state_service.compute_stats(
            ctx.user_id,
            args.get("scope", "global"),
            args.get("plant_id"),
            args.get("period", "this_month"),
        )
        return SkillResult(ok=True, message="통계 조회 완료", data=stats)

