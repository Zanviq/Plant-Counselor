from __future__ import annotations
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class ListCalendarEventsSkill(SkillBase):
    name = "list_calendar_events"
    description = (
        "캘린더에 직접 추가된 '일반 일정'(봉우리가 아닌 순수 일정)을 조회합니다. "
        "식물 봉우리 일정(list_buds)과는 별개입니다. "
        "from/to로 기간을 지정할 수 있고, 생략하면 최근~앞으로 1년의 일정을 가져옵니다."
    )
    parameters = {
        "type": "object",
        "properties": {
            "from": {"type": "string", "description": "시작 날짜 YYYY-MM-DD (선택)"},
            "to": {"type": "string", "description": "종료 날짜 YYYY-MM-DD (선택)"},
        },
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        from datetime import date, timedelta
        import app.runtime_settings as rs

        if ctx.calendar_service is None:
            return SkillResult(ok=False, message="캘린더 서비스를 사용할 수 없습니다.", error_code="no_service")

        today = rs.today()

        def _parse(value, default: date) -> date:
            try:
                return date.fromisoformat(str(value)[:10])
            except (ValueError, TypeError):
                return default

        d_from = _parse(args.get("from"), today - timedelta(days=30))
        d_to = _parse(args.get("to"), today + timedelta(days=365))

        events = ctx.calendar_service.list_range(ctx.user_id, d_from, d_to)

        plant_names: dict[str, str] = {}
        if ctx.plant_service:
            plant_names = {p.id: p.name for p in ctx.plant_service.list(ctx.user_id)}

        items = [
            {
                "id": e.id,
                "title": e.title,
                "date": str(e.event_date)[:10],
                "detail": getattr(e, "detail", "") or "",
                "plant_name": plant_names.get(getattr(e, "plant_id", None), ""),
            }
            for e in events
        ]
        return SkillResult(
            ok=True,
            message=(f"일반 일정 {len(items)}건을 조회했습니다." if items else "등록된 일반 일정이 없습니다."),
            data={"events": items, "count": len(items)},
        )
