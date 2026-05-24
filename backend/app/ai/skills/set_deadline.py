from __future__ import annotations
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class SetDeadlineSkill(SkillBase):
    name = "set_deadline"
    description = (
        "봉우리에 마감일을 설정합니다. "
        "사용자가 구체적인 날짜를 언급하거나 마감이 있다고 말할 때 호출하세요."
    )
    parameters = {
        "type": "object",
        "properties": {
            "bud_id": {"type": "string", "description": "대상 봉우리 ID"},
            "deadline": {"type": "string", "description": "마감일 (YYYY-MM-DD)"},
        },
        "required": ["bud_id", "deadline"],
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        from datetime import date

        try:
            d = date.fromisoformat(args["deadline"])
        except ValueError:
            return SkillResult(
                ok=False,
                message="날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력해주세요.",
                error_code="invalid_argument",
            )
        ctx.bud_service.set_deadline(ctx.user_id, args["bud_id"], d)
        return SkillResult(
            ok=True,
            message=f"마감일을 {args['deadline']}로 설정했습니다.",
            data={"deadline": args["deadline"]},
        )
