from __future__ import annotations
from app.ai.permissions import can_delete_plant
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class DeletePlantSkill(SkillBase):
    name = "delete_plant"
    description = (
        "식물을 삭제 또는 보관합니다. "
        "대화에서 사용자가 명시적으로 삭제 의사를 밝혔을 때만 호출하세요. "
        "archive=true이면 보관(복구 가능), false이면 완전 삭제입니다."
    )
    parameters = {
        "type": "object",
        "properties": {
            "plant_id": {"type": "string", "description": "삭제할 식물 ID"},
            "archive": {"type": "boolean", "description": "true: 보관(기본), false: 완전삭제"},
        },
        "required": ["plant_id"],
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        allowed, msg = can_delete_plant(ctx, args["plant_id"])
        if not allowed:
            return SkillResult(ok=False, message=msg, error_code="forbidden", data={"forbidden": True})
        ctx.plant_service.delete(
            ctx.user_id, args["plant_id"], args.get("archive", True)
        )
        action = "보관" if args.get("archive", True) else "삭제"
        return SkillResult(ok=True, message=f"식물을 {action}했습니다.", data={})
