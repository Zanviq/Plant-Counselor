from __future__ import annotations
from datetime import datetime, date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session
from ulid import ULID

from app.db.models.bud import Bud, BudHistory


class BudRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        user_id: str,
        plant_id: str,
        title: str,
        type: str = "concern",
        detail: str = "",
        deadline: date | None = None,
    ) -> Bud:
        bud = Bud(
            id=str(ULID()),
            user_id=user_id,
            plant_id=plant_id,
            title=title,
            type=type,
            detail=detail,
            deadline=deadline,
        )
        self.db.add(bud)
        self.db.flush()
        return bud

    def get(self, user_id: str, bud_id: str) -> Bud | None:
        stmt = select(Bud).where(Bud.id == bud_id, Bud.user_id == user_id)
        return self.db.scalar(stmt)

    def list(
        self,
        user_id: str,
        plant_id: str | None = None,
        statuses: list[str] | None = None,
        bud_type: str | None = None,
        wilting_only: bool = False,
        deadline_within_days: int | None = None,
        limit: int = 50,
    ) -> list[Bud]:
        stmt = select(Bud).where(Bud.user_id == user_id)

        if plant_id is not None:
            stmt = stmt.where(Bud.plant_id == plant_id)
        if statuses is not None:
            stmt = stmt.where(Bud.status.in_(statuses))
        if bud_type is not None:
            stmt = stmt.where(Bud.type == bud_type)
        if wilting_only:
            stmt = stmt.where(Bud.status == "wilting")
        if deadline_within_days is not None:
            cutoff = date.today() + timedelta(days=deadline_within_days)
            stmt = stmt.where(Bud.deadline != None, Bud.deadline <= cutoff)  # noqa: E711

        stmt = stmt.order_by(Bud.created_at.desc()).limit(limit)
        return list(self.db.scalars(stmt).all())

    def update(self, user_id: str, bud_id: str, fields: dict) -> Bud | None:
        bud = self.get(user_id, bud_id)
        if bud is None:
            return None
        for key, value in fields.items():
            setattr(bud, key, value)
        self.db.flush()
        return bud

    def add_history(
        self,
        bud_id: str,
        from_status: str,
        to_status: str,
        reason: str = "",
    ) -> BudHistory:
        history = BudHistory(
            id=str(ULID()),
            bud_id=bud_id,
            from_status=from_status,
            to_status=to_status,
            at=datetime.utcnow(),
            reason=reason,
        )
        self.db.add(history)
        self.db.flush()
        return history

    def get_history(self, bud_id: str) -> list[BudHistory]:
        stmt = (
            select(BudHistory)
            .where(BudHistory.bud_id == bud_id)
            .order_by(BudHistory.at.asc())
        )
        return list(self.db.scalars(stmt).all())

    def count_active(self, plant_id: str) -> int:
        from sqlalchemy import func
        result = self.db.scalar(
            select(func.count()).select_from(Bud).where(
                Bud.plant_id == plant_id,
                Bud.status.not_in(["harvested", "rot"]),
                Bud.disappeared_at.is_(None),
            )
        )
        return result or 0

