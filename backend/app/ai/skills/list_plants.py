from __future__ import annotations
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class ListPlantsSkill(SkillBase):
    name = "list_plants"
    description = "사용자의 식물 목록을 조회합니다."
    parameters = {
        "type": "object",
        "properties": {
            "include_dormant": {"type": "boolean"},
            "sort": {"type": "string"},
        },
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        plants = ctx.plant_service.list(
            ctx.user_id,
            args.get("include_dormant", False),
            args.get("sort", "activity"),
        )
        data = [
            {"id": p.id, "name": p.name, "status": p.status, "stats": p.stats}
            for p in plants
        ]
        return SkillResult(
            ok=True,
            message=f"식물 {len(data)}개",
            data={"plants": data},
        )

