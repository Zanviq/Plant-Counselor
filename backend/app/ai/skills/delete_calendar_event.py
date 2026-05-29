from __future__ import annotations
from app.ai.permissions import can_modify_calendar_event
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class DeleteCalendarEventSkill(SkillBase):
    name = "delete_calendar_event"
    description = (
        "캘린더의 '일반 일정'(봉우리가 아닌 순수 일정)을 삭제합니다. "
        "event_id가 필요하므로 먼저 list_calendar_events로 대상을 찾으세요. "
        "캘린더 세션 또는 전체 세션에서만 사용할 수 있습니다."
    )
    parameters = {
        "type": "object",
        "properties": {
            "event_id": {"type": "string", "description": "삭제할 일정 ID"},
        },
        "required": ["event_id"],
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        allowed, msg = can_modify_calendar_event(ctx)
        if not allowed:
            return SkillResult(ok=False, message=msg, error_code="forbidden", data={"forbidden": True})
        if ctx.calendar_service is None:
            return SkillResult(ok=False, message="캘린더 서비스를 사용할 수 없습니다.", error_code="no_service")

        ok = ctx.calendar_service.delete(ctx.user_id, args["event_id"])
        if not ok:
            return SkillResult(ok=False, message="일정을 찾을 수 없습니다.", error_code="not_found")
        return SkillResult(ok=True, message="일정을 삭제했습니다.", data={"deleted_id": args["event_id"]})
