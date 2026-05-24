from __future__ import annotations
from datetime import datetime, date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models.bud import Bud
from app.db.models.plant import Plant
from app.repositories.garden_state_repo import GardenStateRepository
from app.repositories.plant_repo import PlantRepository


class GardenStateService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._repo = GardenStateRepository(db)
        self._plant_repo = PlantRepository(db)

    # ------------------------------------------------------------------
    # 집계 / 요약
    # ------------------------------------------------------------------

    def refresh_summary(self, user_id: str) -> dict:
        """Recompute bud/plant counters in a single aggregate query.

        Previously this ran 6 separate `SELECT COUNT(*)` queries. Now it runs
        ONE query that uses conditional SUMs (works on SQLite and Postgres) +
        a single plant-count query.
        """
        today = date.today()
        month_start_dt = datetime.combine(today.replace(day=1), datetime.min.time())
        active = ("seed", "bud", "flower", "fruit", "wilting")

        # case_when helper — portable across SQLAlchemy dialects.
        from sqlalchemy import case, and_

        def sum_when(cond):
            return func.coalesce(func.sum(case((cond, 1), else_=0)), 0)

        row = self.db.execute(
            select(
                sum_when(and_(Bud.type == "concern", Bud.status.in_(active))).label("active_concerns"),
                sum_when(and_(Bud.type == "schedule", Bud.status.in_(active))).label("active_schedules"),
                sum_when(and_(Bud.status == "harvested", Bud.updated_at >= month_start_dt)).label("harvested_this_month"),
                sum_when(Bud.status == "wilting").label("wilting_count"),
                sum_when(Bud.status == "rot").label("rot_count"),
            ).where(Bud.user_id == user_id)
        ).one()

        total_plants = self.db.scalar(
            select(func.count()).select_from(Plant)
            .where(Plant.user_id == user_id, Plant.status != "archived")
        ) or 0

        summary = {
            "active_concerns":       int(row.active_concerns or 0),
            "active_schedules":      int(row.active_schedules or 0),
            "harvested_this_month":  int(row.harvested_this_month or 0),
            "wilting_count":         int(row.wilting_count or 0),
            "rot_count":             int(row.rot_count or 0),
            "total_plants":          int(total_plants),
        }
        self._repo.update(user_id, {"summary_cache": summary})
        self.db.commit()
        return summary

    def get_summary(self, user_id: str) -> dict:
        state = self._repo.get_or_create(user_id)
        return state.summary_cache or {}

    def compute_stats(
        self,
        user_id: str,
        scope: str,
        plant_id: str | None = None,
        period: str = "all",
    ) -> dict:
        """간단한 집계 통계를 반환합니다."""
        filters = [Bud.user_id == user_id]
        if plant_id:
            filters.append(Bud.plant_id == plant_id)
        if period == "month":
            month_start = date.today().replace(day=1)
            filters.append(
                Bud.created_at >= datetime.combine(month_start, datetime.min.time())
            )

        def _count(*extra):
            stmt = select(func.count()).select_from(Bud).where(*filters, *extra)
            return self.db.scalar(stmt) or 0

        return {
            "total": _count(),
            "active": _count(Bud.status.in_(["seed", "bud", "flower", "fruit"])),
            "harvested": _count(Bud.status == "harvested"),
            "wilting": _count(Bud.status == "wilting"),
            "rot": _count(Bud.status == "rot"),
        }

    def build_briefing(self, user_id: str) -> str:
        summary = self.refresh_summary(user_id)
        plants = self._plant_repo.list(user_id)
        plant_names = ", ".join(p.name for p in plants[:5]) if plants else "없음"
        return (
            f"현재 정원에는 {summary.get('total_plants', 0)}개의 식물이 있습니다. "
            f"활성 고민 {summary.get('active_concerns', 0)}개, "
            f"일정 {summary.get('active_schedules', 0)}개가 진행 중이며, "
            f"이번 달 {summary.get('harvested_this_month', 0)}개를 수확했습니다. "
            f"주요 분야: {plant_names}."
        )

    def mark_opened(self, user_id: str) -> None:
        self._repo.update(user_id, {"last_opened_at": datetime.utcnow()})
        self.db.commit()

    def get_daily_briefing(self, user_id: str) -> str | None:
        state = self._repo.get_or_create(user_id)
        today = date.today()
        if state.daily_briefing_date == today:
            return state.daily_briefing
        return None

    def set_daily_briefing(self, user_id: str, text: str) -> None:
        self._repo.update(
            user_id,
            {"daily_briefing": text, "daily_briefing_date": date.today()},
        )
        self.db.commit()

