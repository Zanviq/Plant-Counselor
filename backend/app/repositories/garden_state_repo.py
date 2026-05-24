from __future__ import annotations
from sqlalchemy import select
from sqlalchemy.orm import Session
from ulid import ULID

from app.db.models.garden_state import GardenState


class GardenStateRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_or_create(self, user_id: str) -> GardenState:
        stmt = select(GardenState).where(GardenState.user_id == user_id)
        state = self.db.scalar(stmt)
        if state is None:
            state = GardenState(
                id=str(ULID()),
                user_id=user_id,
            )
            self.db.add(state)
            self.db.flush()
        return state

    def update(self, user_id: str, fields: dict) -> GardenState:
        state = self.get_or_create(user_id)
        for key, value in fields.items():
            setattr(state, key, value)
        self.db.flush()
        return state

