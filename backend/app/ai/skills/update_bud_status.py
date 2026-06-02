from __future__ import annotations
from app.ai.permissions import guard_bud
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class UpdateBudStatusSkill(SkillBase):
    name = "update_bud_status"
    description = "봉우리의 상태를 변경합니다."
    parameters = {
        "type": "object",
        "properties": {
            "bud_id": {"type": "string"},
            "to_status": {
                "type": "string",
                "enum": ["bud", "flower", "fruit", "harvested", "wilting", "rot"],
            },
            "reason": {"type": "string"},
        },
        "required": ["bud_id", "to_status"],
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        _, err = guard_bud(ctx, args["bud_id"])
        if err:
            return err
        try:
            bud = ctx.bud_service.update_status(
                ctx.user_id,
                args["bud_id"],
                args["to_status"],
                args.get("reason", "user:manual"),
            )
        except ValueError as exc:
            return SkillResult(
                ok=False,
                message=str(exc),
                error_code="invalid_status_transition",
            )
        if bud is None:
            return SkillResult(
                ok=False,
                message="봉우리를 찾을 수 없습니다.",
                error_code="not_found",
            )
        return SkillResult(
            ok=True,
            message=f"상태를 {args['to_status']}로 변경했습니다.",
            data={"status": bud.status},
        )
