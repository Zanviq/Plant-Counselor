"""Statistics, briefing, and calendar endpoints.

Summary is computed live each request (cheap aggregate counts) because
mutations from chat skills do NOT invalidate the cached summary, and we
prefer a slightly slower request over a stale dashboard.
"""
from __future__ import annotations
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.models.user import User
from app.deps import get_db, require_user
from app.services.bud_service import BudService
from app.services.garden_state_service import GardenStateService

router = APIRouter(tags=["stats"])


@router.get("/stats/summary")
def get_summary(
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    summary = GardenStateService(db).refresh_summary(user.id)
    return {"ok": True, "data": summary}


@router.get("/briefing/today")
def get_briefing(
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
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
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Returns events grouped by ISO date. Only buds with deadlines appear."""
    try:
        d_from = date.fromisoformat(from_date)
        d_to = date.fromisoformat(to_date)
    except ValueError:
        raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD.")
    # Cap range to one year to bound the result size.
    if d_to - d_from > timedelta(days=366):
        raise HTTPException(400, "Range too large (max 366 days).")

    from app.services.plant_service import PlantService
    buds = BudService(db).list(user.id)
    # Build plant name lookup
    plant_svc = PlantService(db)
    plant_names: dict[str, str] = {}
    for p in plant_svc.list(user.id):
        plant_names[p.id] = p.name

    events: dict[str, list] = {}
    for bud in buds:
        if bud.deadline and d_from <= bud.deadline <= d_to:
            key = bud.deadline.isoformat()
            events.setdefault(key, []).append({
                "id": bud.id,
                "title": bud.title,
                "status": bud.status,
                "type": bud.type,
                "detail": bud.detail or "",
                "plant_name": plant_names.get(bud.plant_id, ""),
                "plant_id": bud.plant_id,
            })
    return {"ok": True, "data": {"events": events}}
