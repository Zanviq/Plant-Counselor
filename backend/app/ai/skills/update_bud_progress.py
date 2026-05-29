from __future__ import annotations
from app.ai.permissions import guard_bud
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class UpdateBudProgressSkill(SkillBase):
    name = "update_bud_progress"
    description = "봉우리의 진행률을 업데이트합니다."
    parameters = {
        "type": "object",
        "properties": {
            "bud_id": {"type": "string"},
            "progress": {"type": "integer", "minimum": 0, "maximum": 100},
        },
        "required": ["bud_id", "progress"],
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        _, err = guard_bud(ctx, args["bud_id"])
        if err:
            return err
        bud = ctx.bud_service.update_progress(
            ctx.user_id, args["bud_id"], args["progress"]
        )
        if bud is None:
            return SkillResult(
                ok=False,
                message="봉우리를 찾을 수 없습니다.",
                error_code="not_found",
            )
        return SkillResult(
            ok=True,
            message=f"진행률을 {bud.progress}%로 업데이트했습니다.",
            data={"progress": bud.progress, "status": bud.status},
        )

