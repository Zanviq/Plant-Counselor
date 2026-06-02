from __future__ import annotations
from app.ai.permissions import can_modify_calendar_event
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class UpdateCalendarEventSkill(SkillBase):
    name = "update_calendar_event"
    description = (
        "캘린더의 '일반 일정'(봉우리가 아닌 순수 일정)을 수정합니다. "
        "event_id가 필요하므로 먼저 list_calendar_events로 대상을 찾으세요. "
        "캘린더 세션 또는 전체 세션에서만 사용할 수 있습니다."
    )
    parameters = {
        "type": "object",
        "properties": {
            "event_id": {"type": "string", "description": "수정할 일정 ID"},
            "title": {"type": "string", "description": "새 제목 (선택)"},
            "date": {"type": "string", "description": "새 날짜 YYYY-MM-DD (선택)"},
            "detail": {"type": "string", "description": "새 세부 정보 (선택)"},
            "plant_id": {"type": "string", "description": "연결할 식물 ID (선택)"},
            "color": {
                "type": "string",
                "enum": ["olive", "blue", "yellow", "red", "pink", "purple"],
                "description": "새 표시 색상 (선택)",
            },
        },
        "required": ["event_id"],
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        allowed, msg = can_modify_calendar_event(ctx)
        if not allowed:
            return SkillResult(ok=False, message=msg, error_code="forbidden", data={"forbidden": True})
        if ctx.calendar_service is None:
            return SkillResult(ok=False, message="캘린더 서비스를 사용할 수 없습니다.", error_code="no_service")

        fields: dict = {}
        if args.get("title") is not None:
            fields["title"] = args["title"]
        if args.get("detail") is not None:
            fields["detail"] = args["detail"]
        if args.get("plant_id") is not None:
            fields["plant_id"] = args["plant_id"]
        if args.get("color") is not None:
            fields["color"] = args["color"]
        if args.get("date") is not None:
            from datetime import date
            try:
                fields["event_date"] = date.fromisoformat(str(args["date"])[:10])
            except (ValueError, TypeError):
                return SkillResult(ok=False, message="날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)", error_code="bad_date")
        if not fields:
            return SkillResult(ok=False, message="수정할 내용이 없습니다.", error_code="no_fields")

        try:
            ev = ctx.calendar_service.update(ctx.user_id, args["event_id"], fields)
        except ValueError as e:
            return SkillResult(ok=False, message=str(e), error_code="not_found")
        return SkillResult(
            ok=True,
            message=f"일정 '{ev.title}'을(를) 수정했습니다.",
            data={"event_id": ev.id},
        )
