from __future__ import annotations
from datetime import datetime, date

from sqlalchemy.orm import Session

from app.db.models.bud import Bud, BudHistory
from app.repositories.bud_repo import BudRepository

# 진행도(%) → 자동 전이 상태 맵
_PROGRESS_TRANSITIONS: list[tuple[int, str]] = [
    (85, "fruit"),
    (60, "flower"),
    (30, "bud"),
]

_ACTIVE_STATUSES = {"seed", "bud", "flower", "fruit", "wilting"}


class BudService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._repo = BudRepository(db)

    def create(
        self,
        user_id: str,
        plant_id: str,
        title: str,
        type: str = "concern",
        detail: str = "",
        deadline: date | None = None,
    ) -> Bud:
        bud = self._repo.create(user_id, plant_id, title, type, detail, deadline)
        # 생성 이력 기록
        self._repo.add_history(bud.id, "", "seed", "생성")
        self.db.commit()
        self.db.refresh(bud)
        return bud

    def get(self, user_id: str, bud_id: str) -> Bud:
        bud = self._repo.get(user_id, bud_id)
        if bud is None:
            raise ValueError(f"봉우리를 찾을 수 없습니다: {bud_id}")
        return bud

    def list(
        self,
        user_id: str,
        plant_id: str | None = None,
        statuses: list[str] | None = None,
        bud_type: str | None = None,
        wilting_only: bool = False,
        filters: dict | None = None,
    ) -> list[Bud]:
        if filters is not None:
            # dict 방식 하위 호환
            return self._repo.list(
                user_id=user_id,
                plant_id=filters.get("plant_id"),
                statuses=filters.get("statuses"),
                bud_type=filters.get("bud_type"),
                wilting_only=filters.get("wilting_only", False),
                deadline_within_days=filters.get("deadline_within_days"),
                limit=filters.get("limit", 50),
            )
        return self._repo.list(
            user_id=user_id,
            plant_id=plant_id,
            statuses=statuses,
            bud_type=bud_type,
            wilting_only=wilting_only,
        )

    def update_status(
        self, user_id: str, bud_id: str, to_status: str, reason: str = ""
    ) -> Bud:
        bud = self.get(user_id, bud_id)
        from_status = bud.status
        bud.status = to_status
        bud.last_progress_at = datetime.utcnow()
        self.db.flush()
        self._repo.add_history(bud_id, from_status, to_status, reason)
        self.db.commit()
        self.db.refresh(bud)
        return bud

    def update_progress(
        self,
        user_id: str,
        bud_id: str,
        progress: int,
        auto_transition: bool = True,
        note: str = "",
    ) -> Bud:
        bud = self.get(user_id, bud_id)
        progress = max(0, min(100, progress))
        bud.progress = progress
        bud.last_progress_at = datetime.utcnow()

        if auto_transition:
            target_status = bud.status
            for threshold, status in _PROGRESS_TRANSITIONS:
                if progress >= threshold:
                    target_status = status
                    break

            if target_status != bud.status:
                from_status = bud.status
                bud.status = target_status
                self.db.flush()
                self._repo.add_history(
                    bud_id,
                    from_status,
                    target_status,
                    note or f"진행도 {progress}% 자동 전이",
                )
            else:
                self.db.flush()
        else:
            self.db.flush()

        self.db.commit()
        self.db.refresh(bud)
        return bud

    def set_deadline(self, user_id: str, bud_id: str, deadline: date) -> Bud:
        bud = self._repo.update(user_id, bud_id, {"deadline": deadline})
        if bud is None:
            raise ValueError(f"봉우리를 찾을 수 없습니다: {bud_id}")
        self.db.commit()
        self.db.refresh(bud)
        return bud

    def abandon(self, user_id: str, bud_id: str, reason: str = "") -> Bud:
        return self.update_status(user_id, bud_id, "rot", reason or "포기")

    def harvest(self, user_id: str, bud_id: str, note: str = "") -> Bud:
        return self.update_status(user_id, bud_id, "harvested", note or "수확")

    def mark_wilting(self, user_id: str, bud_id: str) -> Bud:
        return self.update_status(user_id, bud_id, "wilting", "시들기 시작")

    def get_with_history(self, user_id: str, bud_id: str) -> tuple[Bud | None, list[BudHistory]]:
        bud = self._repo.get(user_id, bud_id)
        if bud is None:
            return None, []
        history = self._repo.get_history(bud_id)
        return bud, history

    def purge_disappeared(self, user_id: str, older_than_days: int) -> None:
        """disappeared_at이 설정되지 않은 rot/harvested 봉우리에 disappeared_at을 설정합니다."""
        from datetime import timedelta
        from sqlalchemy import select
        from app.db.models.bud import Bud

        cutoff = datetime.utcnow() - timedelta(days=older_than_days)
        stmt = select(Bud).where(
            Bud.user_id == user_id,
            Bud.status.in_(["rot", "harvested"]),
            Bud.disappeared_at.is_(None),
            Bud.updated_at <= cutoff,
        )
        buds = list(self.db.scalars(stmt).all())
        now = datetime.utcnow()
        for bud in buds:
            bud.disappeared_at = now
        if buds:
            self.db.commit()

