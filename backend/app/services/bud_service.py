from __future__ import annotations
from datetime import date
from types import SimpleNamespace

from supabase import Client

import app.runtime_settings as rs
from app.repositories.bud_repo import BudRepository

_PROGRESS_TRANSITIONS: list[tuple[int, str]] = [
    (85, "fruit"),
    (60, "flower"),
    (30, "bud"),
]


class BudService:
    def __init__(self, db: Client) -> None:
        self.db = db
        self._repo = BudRepository(db)

    def create(self, user_id: str, plant_id: str, title: str, type: str = "concern",
               detail: str = "", deadline: date | None = None) -> SimpleNamespace:
        bud = self._repo.create(user_id, plant_id, title, type, detail, deadline)
        self._repo.add_history(bud.id, "", "seed", "생성")
        return bud

    def get(self, user_id: str, bud_id: str) -> SimpleNamespace:
        bud = self._repo.get(user_id, bud_id)
        if bud is None:
            raise ValueError(f"봉우리를 찾을 수 없습니다: {bud_id}")
        return bud

    def list(self, user_id: str, plant_id: str | None = None, statuses: list[str] | None = None,
             bud_type: str | None = None, wilting_only: bool = False,
             filters: dict | None = None) -> list[SimpleNamespace]:
        if filters is not None:
            return self._repo.list(
                user_id=user_id,
                plant_id=filters.get("plant_id"),
                statuses=filters.get("statuses"),
                bud_type=filters.get("bud_type"),
                wilting_only=filters.get("wilting_only", False),
                deadline_within_days=filters.get("deadline_within_days"),
                limit=filters.get("limit", 50),
            )
        return self._repo.list(user_id=user_id, plant_id=plant_id, statuses=statuses,
                               bud_type=bud_type, wilting_only=wilting_only)

    def update_status(self, user_id: str, bud_id: str, to_status: str, reason: str = "") -> SimpleNamespace:
        bud = self.get(user_id, bud_id)
        from_status = bud.status
        updated = self._repo.update(user_id, bud_id, {
            "status": to_status,
            "last_progress_at": rs.now().isoformat(),
        })
        self._repo.add_history(bud_id, from_status, to_status, reason)
        return updated or bud

    def update_progress(self, user_id: str, bud_id: str, progress: int,
                        auto_transition: bool = True, note: str = "") -> SimpleNamespace:
        bud = self.get(user_id, bud_id)
        progress = max(0, min(100, progress))
        fields: dict = {"progress": progress, "last_progress_at": rs.now().isoformat()}

        if auto_transition:
            target_status = bud.status
            for threshold, status in _PROGRESS_TRANSITIONS:
                if progress >= threshold:
                    target_status = status
                    break
            if target_status != bud.status:
                fields["status"] = target_status
                self._repo.add_history(bud_id, bud.status, target_status,
                                       note or f"진행도 {progress}% 자동 전이")

        updated = self._repo.update(user_id, bud_id, fields)
        return updated or bud

    def set_deadline(self, user_id: str, bud_id: str, deadline: date) -> SimpleNamespace:
        bud = self._repo.update(user_id, bud_id, {"deadline": deadline.isoformat()})
        if bud is None:
            raise ValueError(f"봉우리를 찾을 수 없습니다: {bud_id}")
        return bud

    def abandon(self, user_id: str, bud_id: str, reason: str = "") -> SimpleNamespace:
        return self.update_status(user_id, bud_id, "rot", reason or "포기")

    def harvest(self, user_id: str, bud_id: str, note: str = "") -> SimpleNamespace:
        return self.update_status(user_id, bud_id, "harvested", note or "수확")

    def mark_wilting(self, user_id: str, bud_id: str) -> SimpleNamespace:
        return self.update_status(user_id, bud_id, "wilting", "시들기 시작")

    def get_with_history(self, user_id: str, bud_id: str) -> tuple[SimpleNamespace | None, list[SimpleNamespace]]:
        bud = self._repo.get(user_id, bud_id)
        if bud is None:
            return None, []
        history = self._repo.get_history(bud_id)
        return bud, history
