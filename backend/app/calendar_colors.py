"""Allowed colors for standalone calendar events."""
from __future__ import annotations

from typing import Literal

CalendarEventColor = Literal["olive", "blue", "yellow", "red", "pink", "purple"]

CALENDAR_EVENT_COLORS: tuple[CalendarEventColor, ...] = (
    "olive",
    "blue",
    "yellow",
    "red",
    "pink",
    "purple",
)
DEFAULT_CALENDAR_EVENT_COLOR: CalendarEventColor = "olive"


def validate_calendar_event_color(value: str) -> CalendarEventColor:
    if value not in CALENDAR_EVENT_COLORS:
        raise ValueError(f"지원하지 않는 일정 색상입니다: {value}")
    return value  # type: ignore[return-value]
