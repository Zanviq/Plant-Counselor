from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.deps import get_db, require_user
from app.repositories.bud_repo import BudRepository
from app.schemas.bud import BudHistoryOut, BudOut, BudPatch, BudProgressUpdate
from app.services.bud_service import BudService

router = APIRouter(prefix="/buds", tags=["buds"])


@router.get("")
def list_buds(plant_id: str | None = None, wilting_only: bool = False,
              user=Depends(require_user), db: Client = Depends(get_db)):
    buds = BudService(db).list(user.id, plant_id=plant_id, wilting_only=wilting_only)
    return {"ok": True, "data": {"items": [BudOut.model_validate(b) for b in buds]}}


@router.get("/{bud_id}")
def get_bud(bud_id: str, user=Depends(require_user), db: Client = Depends(get_db)):
    svc = BudService(db)
    bud, history = svc.get_with_history(user.id, bud_id)
    if not bud:
        raise HTTPException(404, "봉우리를 찾을 수 없습니다.")
    return {
        "ok": True,
        "data": {
            "bud": BudOut.model_validate(bud),
            "history": [BudHistoryOut.model_validate(h) for h in history],
        },
    }


@router.patch("/{bud_id}")
def patch_bud(bud_id: str, body: BudPatch, user=Depends(require_user), db: Client = Depends(get_db)):
    svc = BudService(db)
    bud = svc.get(user.id, bud_id)
    if not bud:
        raise HTTPException(404)
    updated = BudRepository(db).update(user.id, bud_id, body.model_dump(exclude_none=True))
    return {"ok": True, "data": BudOut.model_validate(updated or bud)}


@router.patch("/{bud_id}/progress")
def set_bud_progress(bud_id: str, body: BudProgressUpdate,
                     user=Depends(require_user), db: Client = Depends(get_db)):
    """Directly set a bud's progress (manual slider). Applies the same
    auto status-transition + history as the AI skill. The optional note is the
    user's reason for the change."""
    svc = BudService(db)
    bud = svc.get(user.id, bud_id)
    if not bud:
        raise HTTPException(404, "봉우리를 찾을 수 없습니다.")
    note = body.note.strip() or "사용자 수동 조정"
    updated = svc.update_progress(user.id, bud_id, body.progress, auto_transition=True, note=note)
    return {"ok": True, "data": BudOut.model_validate(updated or bud)}
