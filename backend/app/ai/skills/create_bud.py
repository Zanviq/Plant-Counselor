from __future__ import annotations
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class CreateBudSkill(SkillBase):
    name = "create_bud"
    description = "식물에 새 봉우리(고민/일정)를 추가합니다."
    parameters = {
        "type": "object",
        "properties": {
            "plant_id": {"type": "string"},
            "title": {"type": "string"},
            "type": {"type": "string", "enum": ["concern", "schedule"]},
            "detail": {"type": "string"},
            "deadline": {"type": "string"},
        },
        "required": ["plant_id", "title", "type"],
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        deadline = args.get("deadline")
        if deadline:
            from datetime import date

            try:
                deadline = date.fromisoformat(deadline)
            except ValueError:
                deadline = None
        bud = ctx.bud_service.create(
            ctx.user_id,
            args["plant_id"],
            args["title"],
            args["type"],
            args.get("detail", ""),
            deadline,
        )
        return SkillResult(
            ok=True,
            message=f"봉우리 '{bud.title}'를 추가했습니다.",
            data={"bud_id": bud.id},
        )

