"""Statistics, briefing, and calendar endpoints."""
from __future__ import annotations
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from supabase import Client

from app.deps import get_db, require_user
from app.services.bud_service import BudService
from app.services.calendar_service import CalendarService
from app.services.garden_state_service import GardenStateService
from app.services.plant_service import PlantService

router = APIRouter(tags=["stats"])


@router.get("/stats/summary")
def get_summary(user=Depends(require_user), db: Client = Depends(get_db)):
    summary = GardenStateService(db).refresh_summary(user.id)
    return {"ok": True, "data": summary}


@router.get("/briefing/today")
def get_briefing(user=Depends(require_user), db: Client = Depends(get_db)):
    svc = GardenStateService(db)
    briefing = svc.get_daily_briefing(user.id)
    if not briefing:
        briefing = svc.build_briefing(user.id)
        svc.set_daily_briefing(user.id, briefing)
    return {"ok": True, "data": {"briefing": briefing}}


@router.get("/calendar")
def get_calendar(
    from_date: str = Query(alias="from"),
    to_date: str = Query(alias="to"),
    user=Depends(require_user),
    db: Client = Depends(get_db),
):
    try:
        d_from = date.fromisoformat(from_date)
        d_to = date.fromisoformat(to_date)
    except ValueError:
        raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD.")
    if d_to - d_from > timedelta(days=366):
        raise HTTPException(400, "Range too large (max 366 days).")

    buds = BudService(db).list(user.id)
    plant_names: dict[str, str] = {p.id: p.name for p in PlantService(db).list(user.id)}

    events: dict[str, list] = {}

    # 1. Bud deadlines (buds created in any scope show up on the calendar).
    for bud in buds:
        dl_raw = getattr(bud, "deadline", None)
        if not dl_raw:
            continue
        dl = date.fromisoformat(str(dl_raw)[:10]) if isinstance(dl_raw, str) else dl_raw
        if d_from <= dl <= d_to:
            key = dl.isoformat()
            events.setdefault(key, []).append({
                "id": bud.id,
                "title": bud.title,
                "status": bud.status,
                "type": bud.type,
                "detail": getattr(bud, "detail", "") or "",
                "plant_name": plant_names.get(bud.plant_id, ""),
                "plant_id": bud.plant_id,
                "source": "bud",
            })

    # 2. Standalone calendar events (added directly, no bud created).
    for ev in CalendarService(db).list_range(user.id, d_from, d_to):
        ed_raw = getattr(ev, "event_date", None)
        if not ed_raw:
            continue
        key = str(ed_raw)[:10]
        events.setdefault(key, []).append({
            "id": ev.id,
            "title": ev.title,
            "status": "event",
            "type": "event",
            "detail": getattr(ev, "detail", "") or "",
            "plant_name": plant_names.get(getattr(ev, "plant_id", None), ""),
            "plant_id": getattr(ev, "plant_id", None),
            "source": "event",
        })

    return {"ok": True, "data": {"events": events}}


# ── Standalone calendar event CRUD ─────────────────────────────────────────────

class CalendarEventCreate(BaseModel):
    title: str
    date: str                       # YYYY-MM-DD
    plant_id: str | None = None     # which plant this schedule relates to
    detail: str = ""


class CalendarEventUpdate(BaseModel):
    title: str | None = None
    date: str | None = None
    plant_id: str | None = None
    detail: str | None = None


def _parse_date(s: str) -> date:
    try:
        return date.fromisoformat(s[:10])
    except (ValueError, TypeError):
        raise HTTPException(400, "날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)")


@router.post("/calendar/events")
def create_calendar_event(body: CalendarEventCreate, user=Depends(require_user), db: Client = Depends(get_db)):
    if not body.title.strip():
        raise HTTPException(400, "일정 제목을 입력해주세요.")
    ev = CalendarService(db).create(
        user.id, body.plant_id, body.title.strip(), body.detail, _parse_date(body.date)
    )
    return {"ok": True, "data": {
        "id": ev.id, "title": ev.title, "detail": ev.detail,
        "date": str(ev.event_date)[:10], "plant_id": ev.plant_id,
    }}


@router.patch("/calendar/events/{event_id}")
def update_calendar_event(event_id: str, body: CalendarEventUpdate, user=Depends(require_user), db: Client = Depends(get_db)):
    fields: dict = {}
    if body.title is not None:
        fields["title"] = body.title.strip()
    if body.detail is not None:
        fields["detail"] = body.detail
    if body.plant_id is not None:
        fields["plant_id"] = body.plant_id
    if body.date is not None:
        fields["event_date"] = _parse_date(body.date)
    try:
        ev = CalendarService(db).update(user.id, event_id, fields)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return {"ok": True, "data": {
        "id": ev.id, "title": ev.title, "detail": ev.detail,
        "date": str(ev.event_date)[:10], "plant_id": ev.plant_id,
    }}


@router.delete("/calendar/events/{event_id}")
def delete_calendar_event(event_id: str, user=Depends(require_user), db: Client = Depends(get_db)):
    ok = CalendarService(db).delete(user.id, event_id)
    if not ok:
        raise HTTPException(404, "일정을 찾을 수 없습니다.")
    return {"ok": True, "data": {"deleted_id": event_id}}
