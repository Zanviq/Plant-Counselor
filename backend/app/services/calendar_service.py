"""CalendarService — standalone calendar events (plain schedules, not buds)."""
from __future__ import annotations

from datetime import date
from types import SimpleNamespace

from supabase import Client

from app.calendar_colors import DEFAULT_CALENDAR_EVENT_COLOR, validate_calendar_event_color
from app.repositories.calendar_event_repo import CalendarEventRepository


class CalendarService:
    def __init__(self, db: Client) -> None:
        self.db = db
        self._repo = CalendarEventRepository(db)

    def create(self, user_id: str, plant_id: str | None, title: str,
               detail: str, event_date: date,
               color: str = DEFAULT_CALENDAR_EVENT_COLOR) -> SimpleNamespace:
        return self._repo.create(
            user_id, plant_id, title, detail, event_date,
            validate_calendar_event_color(color),
        )

    def list_range(self, user_id: str, d_from: date, d_to: date) -> list[SimpleNamespace]:
        return self._repo.list_range(user_id, d_from, d_to)

    def update(self, user_id: str, event_id: str, fields: dict) -> SimpleNamespace:
        if "color" in fields:
            fields["color"] = validate_calendar_event_color(fields["color"])
        ev = self._repo.update(user_id, event_id, fields)
        if ev is None:
            raise ValueError(f"일정을 찾을 수 없습니다: {event_id}")
        return ev

    def delete(self, user_id: str, event_id: str) -> bool:
        return self._repo.delete(user_id, event_id)
