from __future__ import annotations
from types import SimpleNamespace

from supabase import Client

import app.runtime_settings as rs
from app.repositories.garden_state_repo import GardenStateRepository
from app.repositories.plant_repo import PlantRepository
from app.repositories.bud_repo import BudRepository


class GardenStateService:
    def __init__(self, db: Client) -> None:
        self.db = db
        self._repo = GardenStateRepository(db)
        self._plant_repo = PlantRepository(db)

    def refresh_summary(self, user_id: str) -> dict:
        # Fetch all buds and compute stats in Python (no raw SQL needed)
        bud_repo = BudRepository(self.db)
        buds = bud_repo.list(user_id, limit=500)
        plants = self._plant_repo.list(user_id)

        today = rs.today()
        month_start = today.replace(day=1).isoformat()
        active = {"seed", "bud", "flower", "fruit", "wilting"}

        active_concerns = sum(1 for b in buds if b.type == "concern" and b.status in active)
        active_schedules = sum(1 for b in buds if b.type == "schedule" and b.status in active)

        def updated_this_month(b: SimpleNamespace) -> bool:
            ua = getattr(b, "updated_at", None)
            if not ua:
                return False
            ua_str = ua if isinstance(ua, str) else ua.isoformat()
            return ua_str[:10] >= month_start

        harvested_this_month = sum(1 for b in buds if b.status == "harvested" and updated_this_month(b))
        wilting_count = sum(1 for b in buds if b.status == "wilting")
        rot_count = sum(1 for b in buds if b.status == "rot")
        total_plants = len(plants)

        summary = {
            "active_concerns": active_concerns,
            "active_schedules": active_schedules,
            "harvested_this_month": harvested_this_month,
            "wilting_count": wilting_count,
            "rot_count": rot_count,
            "total_plants": total_plants,
        }
        self._repo.update(user_id, {"summary_cache": summary})
        return summary

    def get_summary(self, user_id: str) -> dict:
        state = self._repo.get_or_create(user_id)
        return state.summary_cache or {}

    def compute_stats(self, user_id: str, scope: str, plant_id: str | None = None,
                      period: str = "all") -> dict:
        bud_repo = BudRepository(self.db)
        buds = bud_repo.list(user_id, plant_id=plant_id, limit=500)

        if period == "month":
            month_start = rs.today().replace(day=1).isoformat()
            buds = [b for b in buds if (getattr(b, "created_at", "") or "")[:10] >= month_start]

        return {
            "total": len(buds),
            "active": sum(1 for b in buds if b.status in {"seed", "bud", "flower", "fruit"}),
            "harvested": sum(1 for b in buds if b.status == "harvested"),
            "wilting": sum(1 for b in buds if b.status == "wilting"),
            "rot": sum(1 for b in buds if b.status == "rot"),
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

    def get_daily_briefing(self, user_id: str) -> str | None:
        state = self._repo.get_or_create(user_id)
        today_str = rs.today().isoformat()
        stored_date = getattr(state, "daily_briefing_date", None)
        if stored_date and str(stored_date)[:10] == today_str:
            return getattr(state, "daily_briefing", None)
        return None

    def set_daily_briefing(self, user_id: str, text: str) -> None:
        self._repo.update(user_id, {
            "daily_briefing": text,
            "daily_briefing_date": rs.today().isoformat(),
        })
