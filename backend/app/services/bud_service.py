from __future__ import annotations
from datetime import date
from types import SimpleNamespace

from supabase import Client

import app.runtime_settings as rs
from app.repositories.bud_repo import BudRepository

_PROGRESS_TRANSITIONS: list[tuple[int, str]] = [
    (85, "fruit"),
    (60, "flower"),
]

# Forward (growth) statuses. Once a bud or its plant has wilted it can no longer
# reach any of these — wilting is terminal for growth (chat still allowed).
_GROWTH_STATUSES = {"bud", "flower", "fruit", "harvested"}
_WILTED_STATUSES = {"wilting", "rot"}

_NO_REVIVAL_MSG = (
    "시든 봉우리는 더 이상 성장할 수 없어요. 대화는 가능하지만 소생은 불가능합니다."
)


class BudService:
    def __init__(self, db: Client) -> None:
        self.db = db
        self._repo = BudRepository(db)

    def create(self, user_id: str, plant_id: str, title: str, type: str = "concern",
               detail: str = "", deadline: date | None = None) -> SimpleNamespace:
        bud = self._repo.create(user_id, plant_id, title, type, detail, deadline)
        self._repo.add_history(bud.id, "", "bud", "생성")
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

    def _plant_wilted(self, user_id: str, plant_id: str | None) -> bool:
        if not plant_id:
            return False
        res = (self.db.table("plants").select("status")
               .eq("id", plant_id).eq("user_id", user_id).limit(1).execute())
        return bool(res.data) and res.data[0].get("status") == "wilting"

    def update_status(self, user_id: str, bud_id: str, to_status: str, reason: str = "") -> SimpleNamespace:
        if to_status == "seed":
            raise ValueError("씨앗 단계는 더 이상 사용하지 않습니다.")
        bud = self.get(user_id, bud_id)
        # No revival: a wilted/rotten bud (or any bud on a wilted plant) cannot grow.
        if to_status in _GROWTH_STATUSES and (
            bud.status in _WILTED_STATUSES or self._plant_wilted(user_id, getattr(bud, "plant_id", None))
        ):
            raise ValueError(_NO_REVIVAL_MSG)
        if to_status == "harvested" and bud.progress < 100:
            raise ValueError("수확은 진행률 100%를 달성한 봉우리만 가능합니다.")
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
        # No revival: cannot raise progress on a wilted/rotten bud or a wilted plant.
        if progress > getattr(bud, "progress", 0) and (
            bud.status in _WILTED_STATUSES or self._plant_wilted(user_id, getattr(bud, "plant_id", None))
        ):
            raise ValueError(_NO_REVIVAL_MSG)
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

    def move_to_plant(self, user_id: str, bud_id: str, target_plant_id: str) -> SimpleNamespace:
        bud = self.get(user_id, bud_id)
        if target_plant_id == getattr(bud, "plant_id", None):
            return bud
        target = (
            self.db.table("plants")
            .select("id,name,status")
            .eq("id", target_plant_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not target.data:
            raise ValueError(f"대상 식물을 찾을 수 없습니다: {target_plant_id}")
        if target.data[0].get("status") == "archived":
            raise ValueError("보관된 식물로는 봉우리를 이동할 수 없습니다.")
        updated = self._repo.update(user_id, bud_id, {"plant_id": target_plant_id})
        self._repo.add_history(
            bud_id,
            getattr(bud, "status", ""),
            getattr(bud, "status", "bud"),
            f"식물 이동: {getattr(bud, 'plant_id', '')} -> {target_plant_id}",
        )
        return updated or bud

    def delete(self, user_id: str, bud_id: str) -> None:
        self.get(user_id, bud_id)
        if not self._repo.delete(user_id, bud_id):
            raise ValueError(f"봉우리를 삭제할 수 없습니다: {bud_id}")

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
