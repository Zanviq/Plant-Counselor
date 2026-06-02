from __future__ import annotations
from app.ai.permissions import guard_bud
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class HarvestBudSkill(SkillBase):
    name = "harvest_bud"
    description = "진행률 100%를 달성한 봉우리를 수확(완료) 처리합니다."
    parameters = {
        "type": "object",
        "properties": {
            "bud_id": {"type": "string"},
            "note": {"type": "string"},
        },
        "required": ["bud_id"],
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        _, err = guard_bud(ctx, args["bud_id"])
        if err:
            return err
        try:
            ctx.bud_service.harvest(ctx.user_id, args["bud_id"], args.get("note", ""))
        except ValueError as exc:
            return SkillResult(
                ok=False,
                message=str(exc),
                error_code="harvest_requires_full_progress",
            )
        return SkillResult(
            ok=True,
            message="수고하셨습니다! 봉우리를 수확했습니다.",
            data={"bud_id": args["bud_id"]},
        )
