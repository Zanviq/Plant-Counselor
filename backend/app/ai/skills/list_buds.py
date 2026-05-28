from __future__ import annotations
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class ListBudsSkill(SkillBase):
    name = "list_buds"
    description = (
        "봉우리(Bud) 목록을 조회합니다. "
        "update_bud_progress·update_bud_status·harvest_bud·abandon_bud·set_deadline 등 "
        "bud_id가 필요한 스킬을 호출하기 전에 먼저 이 스킬로 목록을 확인하세요. "
        "plant_id를 지정하면 해당 식물의 봉우리만 반환합니다."
    )
    parameters = {
        "type": "object",
        "properties": {
            "plant_id": {"type": "string"},
            "status": {"type": "string"},
            "type": {"type": "string"},
        },
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        statuses = [args["status"]] if args.get("status") else None
        buds = ctx.bud_service.list(
            ctx.user_id,
            args.get("plant_id"),
            statuses,
            args.get("type"),
        )
        data = [
            {"id": b.id, "title": b.title, "status": b.status, "progress": b.progress}
            for b in buds
        ]
        return SkillResult(
            ok=True,
            message=f"봉우리 {len(data)}개",
            data={"buds": data},
        )

