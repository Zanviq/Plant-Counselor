"""Statistics, briefing, and calendar endpoints."""
from __future__ import annotations
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client

from app.deps import get_db, require_user
from app.services.bud_service import BudService
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
            })
    return {"ok": True, "data": {"events": events}}
