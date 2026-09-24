"""Statistics, briefing, and calendar endpoints."""
from __future__ import annotations
from datetime import date, datetime, timedelta
import csv
import io
import json

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from app.db.pg import Client

from app.calendar_colors import CalendarEventColor, DEFAULT_CALENDAR_EVENT_COLOR
from app.deps import get_db, require_user
from app.services.bud_service import BudService
from app.services.calendar_service import CalendarService
from app.services.garden_state_service import GardenStateService
from app.services.plant_service import PlantService
from app.repositories.bud_repo import BudRepository
from app.repositories.calendar_event_repo import CalendarEventRepository
from app import undo_store

router = APIRouter(tags=["stats"])


def _parse_event_date(value) -> date:
    return date.fromisoformat(str(value)[:10])


def _event_duration_days(start: date, end: date) -> int:
    return max(0, (end - start).days)


def _occurrence_starts(ev, d_from: date, d_to: date) -> list[date]:
    start = _parse_event_date(ev.event_date)
    rule = getattr(ev, "repeat_rule", "none") or "none"
    if rule == "none":
        end = _parse_event_date(getattr(ev, "end_date", ev.event_date))
        if end < d_from or start > d_to:
            return []
        return [start]

    starts: list[date] = []
    cur = start
    if rule == "daily":
        cur = max(start, d_from)
        while cur <= d_to:
            starts.append(cur)
            cur += timedelta(days=1)
        return starts

    while cur <= d_to:
        if cur >= d_from:
            starts.append(cur)
        if rule == "weekly":
            cur += timedelta(days=7)
        elif rule == "monthly":
            year = cur.year + (cur.month // 12)
            month = (cur.month % 12) + 1
            try:
                cur = cur.replace(year=year, month=month)
            except ValueError:
                cur = date(year, month, 1)
        elif rule == "yearly":
            try:
                cur = cur.replace(year=cur.year + 1)
            except ValueError:
                cur = date(cur.year + 1, 3, 1)
        else:
            return []
    return starts


@router.get("/stats/summary")
def get_summary(user=Depends(require_user), db: Client = Depends(get_db)):
    summary = GardenStateService(db).refresh_summary(user.id)
    return {"ok": True, "data": summary}


@router.get("/briefing/today")
def get_briefing(user=Depends(require_user), db: Client = Depends(get_db)):
    # Always rebuilt (pure string formatting, no LLM) so it reflects the
    # current garden state instead of a stale once-a-day cache.
    briefing = GardenStateService(db).build_briefing(user.id)
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
        start = _parse_event_date(ev.event_date)
        end = _parse_event_date(getattr(ev, "end_date", ev.event_date))
        duration_days = _event_duration_days(start, end)
        seen_days: set[str] = set()
        for occurrence_start in _occurrence_starts(ev, d_from, d_to):
            for offset in range(duration_days + 1):
                occurrence_day = occurrence_start + timedelta(days=offset)
                if occurrence_day < d_from or occurrence_day > d_to:
                    continue
                key = occurrence_day.isoformat()
                if key in seen_days:
                    continue
                seen_days.add(key)
                events.setdefault(key, []).append({
                    "id": ev.id,
                    "title": ev.title,
                    "status": "event",
                    "type": "event",
                    "detail": getattr(ev, "detail", "") or "",
                    "plant_name": plant_names.get(getattr(ev, "plant_id", None), ""),
                    "plant_id": getattr(ev, "plant_id", None),
                    "date": str(getattr(ev, "event_date", ""))[:10],
                    "end_date": str(getattr(ev, "end_date", getattr(ev, "event_date", "")))[:10],
                    "time": str(getattr(ev, "event_time", ""))[:5] if getattr(ev, "event_time", None) else None,
                    "end_time": str(getattr(ev, "end_time", ""))[:5] if getattr(ev, "end_time", None) else None,
                    "all_day": bool(getattr(ev, "all_day", True)),
                    "repeat_rule": getattr(ev, "repeat_rule", "none") or "none",
                    "occurrence_date": key,
                    "color": getattr(ev, "color", DEFAULT_CALENDAR_EVENT_COLOR),
                    "source": "event",
                })

    return {"ok": True, "data": {"events": events}}


# ── Standalone calendar event CRUD ─────────────────────────────────────────────

class CalendarEventCreate(BaseModel):
    title: str
    date: str                       # YYYY-MM-DD
    time: str | None = None         # HH:MM start time, omitted for all-day events
    end_date: str | None = None     # YYYY-MM-DD
    end_time: str | None = None     # HH:MM end time, omitted for all-day events
    all_day: bool = True
    repeat_rule: str = "none"
    plant_id: str | None = None     # which plant this schedule relates to
    detail: str = ""
    color: CalendarEventColor = DEFAULT_CALENDAR_EVENT_COLOR


class CalendarEventUpdate(BaseModel):
    title: str | None = None
    date: str | None = None
    time: str | None = None
    end_date: str | None = None
    end_time: str | None = None
    all_day: bool | None = None
    repeat_rule: str | None = None
    plant_id: str | None = None
    detail: str | None = None
    color: CalendarEventColor | None = None


def _parse_date(s: str) -> date:
    try:
        return date.fromisoformat(s[:10])
    except (ValueError, TypeError):
        raise HTTPException(400, "날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)")


def _calendar_event_out(ev, conflicts: list[dict] | None = None) -> dict:
    return {
        "id": ev.id, "title": ev.title, "detail": ev.detail,
        "date": str(ev.event_date)[:10],
        "end_date": str(getattr(ev, "end_date", ev.event_date))[:10],
        "time": str(getattr(ev, "event_time", ""))[:5] if getattr(ev, "event_time", None) else None,
        "end_time": str(getattr(ev, "end_time", ""))[:5] if getattr(ev, "end_time", None) else None,
        "all_day": bool(getattr(ev, "all_day", True)),
        "repeat_rule": getattr(ev, "repeat_rule", "none") or "none",
        "plant_id": ev.plant_id, "color": ev.color,
        "conflicts": conflicts or [],
    }


@router.post("/calendar/events")
def create_calendar_event(body: CalendarEventCreate, user=Depends(require_user), db: Client = Depends(get_db)):
    if not body.title.strip():
        raise HTTPException(400, "일정 제목을 입력해주세요.")
    svc = CalendarService(db)
    try:
        start = _parse_date(body.date)
        end = _parse_date(body.end_date) if body.end_date else None
        conflicts = svc.detect_conflicts(
            user.id, start, body.time, end, body.end_time,
            body.all_day, body.repeat_rule,
        )
        ev = svc.create(
            user.id, body.plant_id, body.title.strip(), body.detail, _parse_date(body.date),
            body.time, _parse_date(body.end_date) if body.end_date else None,
            body.end_time, body.all_day, body.repeat_rule, body.color
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True, "data": _calendar_event_out(ev, conflicts)}


@router.patch("/calendar/events/{event_id}")
def update_calendar_event(event_id: str, body: CalendarEventUpdate, user=Depends(require_user), db: Client = Depends(get_db)):
    fields: dict = {}
    if body.title is not None:
        fields["title"] = body.title.strip()
    if body.detail is not None:
        fields["detail"] = body.detail
    if "plant_id" in body.model_fields_set:
        fields["plant_id"] = body.plant_id
    if body.date is not None:
        fields["event_date"] = _parse_date(body.date)
    if body.end_date is not None:
        fields["end_date"] = _parse_date(body.end_date)
    if body.all_day is not None:
        fields["all_day"] = body.all_day
    if "time" in body.model_fields_set:
        fields["event_time"] = body.time
    if "end_time" in body.model_fields_set:
        fields["end_time"] = body.end_time
    if body.repeat_rule is not None:
        fields["repeat_rule"] = body.repeat_rule
    if body.color is not None:
        fields["color"] = body.color
    svc = CalendarService(db)
    current = CalendarEventRepository(db).get(user.id, event_id)
    if current is None:
        raise HTTPException(404, "일정을 찾을 수 없습니다.")
    try:
        start = fields.get("event_date") or _parse_date(str(current.event_date)[:10])
        end = fields.get("end_date") or _parse_date(str(getattr(current, "end_date", current.event_date))[:10])
        all_day = fields.get("all_day") if "all_day" in fields else bool(getattr(current, "all_day", True))
        event_time = fields.get("event_time") if "event_time" in fields else (
            str(getattr(current, "event_time", ""))[:5] if getattr(current, "event_time", None) else None
        )
        end_time = fields.get("end_time") if "end_time" in fields else (
            str(getattr(current, "end_time", ""))[:5] if getattr(current, "end_time", None) else None
        )
        repeat_rule = fields.get("repeat_rule") or getattr(current, "repeat_rule", "none") or "none"
        conflicts = svc.detect_conflicts(
            user.id, start, event_time, end, end_time, bool(all_day), repeat_rule,
            exclude_event_id=event_id,
        )
        ev = svc.update(user.id, event_id, fields)
    except ValueError as e:
        message = str(e)
        status = 404 if "찾을 수 없습니다" in message else 400
        raise HTTPException(status, message)
    return {"ok": True, "data": _calendar_event_out(ev, conflicts)}


@router.delete("/calendar/events/{event_id}")
def delete_calendar_event(event_id: str, user=Depends(require_user), db: Client = Depends(get_db)):
    repo = CalendarEventRepository(db)
    snapshot = repo.get(user.id, event_id)
    ok = CalendarService(db).delete(user.id, event_id)
    if not ok:
        raise HTTPException(404, "일정을 찾을 수 없습니다.")
    if snapshot is not None:
        undo_store.push(user.id, "calendar_event_restore", f"일정 '{snapshot.title}' 삭제", vars(snapshot))
    return {"ok": True, "data": {"deleted_id": event_id}}


@router.post("/undo/last")
def undo_last(action_id: str | None = None, user=Depends(require_user), db: Client = Depends(get_db)):
    action = undo_store.pop(user.id, action_id)
    if action is None:
        raise HTTPException(404, "되돌릴 작업이 없습니다.")
    if action.kind == "calendar_event_restore":
        restored = CalendarEventRepository(db).restore(action.payload)
        return {"ok": True, "data": {"kind": action.kind, "label": action.label, "id": restored.id}}
    if action.kind == "bud_restore":
        restored = BudRepository(db).restore(action.payload)
        return {"ok": True, "data": {"kind": action.kind, "label": action.label, "id": restored.id}}
    if action.kind == "bud_status_restore":
        bud_id = action.payload["id"]
        fields = {
            "status": action.payload["status"],
            "progress": action.payload.get("progress", 0),
            "last_progress_at": action.payload.get("last_progress_at"),
        }
        restored = BudRepository(db).update(user.id, bud_id, fields)
        if restored is None:
            raise HTTPException(404, "되돌릴 봉우리를 찾을 수 없습니다.")
        return {"ok": True, "data": {"kind": action.kind, "label": action.label, "id": restored.id}}
    raise HTTPException(400, "지원하지 않는 되돌리기 작업입니다.")


def _rows_as_csv(rows: list[dict]) -> str:
    out = io.StringIO()
    keys = sorted({key for row in rows for key in row.keys()})
    writer = csv.DictWriter(out, fieldnames=keys)
    writer.writeheader()
    writer.writerows(rows)
    return out.getvalue()


def _collect_export_data(user_id: str, db: Client) -> dict:
    plant_rows = db.table("plants").select("*").eq("user_id", user_id).execute().data or []
    bud_rows = db.table("buds").select("*").eq("user_id", user_id).execute().data or []
    conversation_rows = db.table("conversations").select("*").eq("user_id", user_id).execute().data or []
    notification_rows = db.table("notifications").select("*").eq("user_id", user_id).execute().data or []
    today = date.today()
    calendar_rows = [vars(ev) for ev in CalendarService(db).list_range(user_id, date(1970, 1, 1), date(today.year + 20, 12, 31))]
    return {
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "plants": plant_rows,
        "buds": bud_rows,
        "calendar_events": calendar_rows,
        "conversations": conversation_rows,
        "notifications": notification_rows,
    }


@router.get("/export/json")
def export_json(user=Depends(require_user), db: Client = Depends(get_db)):
    payload = json.dumps(_collect_export_data(user.id, db), ensure_ascii=False, default=str, indent=2)
    return Response(payload, media_type="application/json", headers={"Content-Disposition": "attachment; filename=plant-counselor-export.json"})


@router.get("/export/csv")
def export_csv(user=Depends(require_user), db: Client = Depends(get_db)):
    data = _collect_export_data(user.id, db)
    parts = []
    for key in ("plants", "buds", "calendar_events", "conversations", "notifications"):
        parts.append(f"# {key}\n{_rows_as_csv(data[key])}")
    return Response("\n\n".join(parts), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": "attachment; filename=plant-counselor-export.csv"})


def _ics_dt(day: str, time_value: str | None, all_day: bool) -> str:
    if all_day or not time_value:
        return str(day).replace("-", "")
    return f"{str(day).replace('-', '')}T{time_value.replace(':', '')}00"


def _ics_date_plus_one(day: str) -> str:
    return (date.fromisoformat(str(day)[:10]) + timedelta(days=1)).isoformat()


@router.get("/export/ics")
def export_ics(user=Depends(require_user), db: Client = Depends(get_db)):
    events = CalendarService(db).list_range(user.id, date(1970, 1, 1), date(date.today().year + 20, 12, 31))
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Plant Counselor//Calendar Export//KO"]
    for ev in events:
        all_day = bool(getattr(ev, "all_day", True))
        start = str(ev.event_date)[:10]
        end = str(getattr(ev, "end_date", ev.event_date))[:10]
        start_time = str(getattr(ev, "event_time", ""))[:5] if getattr(ev, "event_time", None) else None
        end_time = str(getattr(ev, "end_time", ""))[:5] if getattr(ev, "end_time", None) else None
        lines.extend([
            "BEGIN:VEVENT",
            f"UID:{ev.id}@plant-counselor",
            f"SUMMARY:{str(ev.title).replace(chr(10), ' ')}",
            f"DESCRIPTION:{str(getattr(ev, 'detail', '') or '').replace(chr(10), ' ')}",
            f"DTSTART{';VALUE=DATE' if all_day else ''}:{_ics_dt(start, start_time, all_day)}",
            f"DTEND{';VALUE=DATE' if all_day else ''}:{_ics_dt(_ics_date_plus_one(end) if all_day else end, end_time, all_day)}",
            "END:VEVENT",
        ])
    lines.append("END:VCALENDAR")
    return Response("\r\n".join(lines), media_type="text/calendar; charset=utf-8", headers={"Content-Disposition": "attachment; filename=plant-counselor-calendar.ics"})
