from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.models.user import User
from app.deps import get_db, require_user
from app.schemas.plant import PlantOut, PlantUpdate
from app.services.plant_service import PlantService

router = APIRouter(prefix="/plants", tags=["plants"])


@router.get("")
def list_plants(
    sort: str = "activity",
    include_dormant: bool = False,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    plants = PlantService(db).list(user.id, include_dormant, sort)
    return {"ok": True, "data": {"items": [PlantOut.model_validate(p) for p in plants]}}


@router.get("/{plant_id}")
def get_plant(
    plant_id: str,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    plant = PlantService(db).get(user.id, plant_id)
    if not plant:
        raise HTTPException(404, "식물을 찾을 수 없습니다.")
    return {"ok": True, "data": PlantOut.model_validate(plant)}


@router.patch("/{plant_id}")
def update_plant(
    plant_id: str,
    body: PlantUpdate,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    plant = PlantService(db).update(user.id, plant_id, body.model_dump(exclude_none=True))
    return {"ok": True, "data": PlantOut.model_validate(plant)}


@router.delete("/{plant_id}")
def delete_plant(
    plant_id: str,
    hard: bool = False,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    PlantService(db).delete(user.id, plant_id, archive=not hard)
    return {"ok": True, "data": {}}

