from __future__ import annotations
"""
TransitionService: 스케줄러(APScheduler)에서 주기적으로 호출하여
wilting / rot 소멸 / 마감일 경보 알림을 처리합니다.
"""
from datetime import datetime, timedelta, date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.bud import Bud
from app.db.models.user import User
from app.repositories.bud_repo import BudRepository
from app.repositories.notification_repo import NotificationRepository


class TransitionService:
    def scan_all(self, db: Session) -> None:
        """모든 사용자를 대상으로 전이 스캔을 실행합니다."""
        stmt = select(User.id)
        user_ids = list(db.scalars(stmt).all())
        for user_id in user_ids:
            self.scan_user(db, user_id)

    def scan_user(self, db: Session, user_id: str) -> None:
        """단일 사용자에 대해 wilting → rot, 소멸, 마감 경보를 처리합니다."""
        user_stmt = select(User).where(User.id == user_id)
        user = db.scalar(user_stmt)
        if user is None:
            return

        garden_rules: dict = user.garden_rules or {}
        wilting_days: int = garden_rules.get("wilting_days", 7)
        rot_disappear_days: int = garden_rules.get("rot_disappear_days", 14)
        deadline_warn_days: int = garden_rules.get("deadline_warn_days", 3)
        auto_transition: bool = garden_rules.get("auto_transition", True)

        bud_repo = BudRepository(db)
        notif_repo = NotificationRepository(db)
        now = datetime.utcnow()
        today = date.today()

        if auto_transition:
            # 1) 오랫동안 진행 없는 봉우리 → wilting
            wilting_cutoff = now - timedelta(days=wilting_days)
            active_stmt = select(Bud).where(
                Bud.user_id == user_id,
                Bud.status.in_(["seed", "bud", "flower", "fruit"]),
            )
            for bud in db.scalars(active_stmt).all():
                last = bud.last_progress_at or bud.created_at
                if last <= wilting_cutoff:
                    old_status = bud.status
                    bud.status = "wilting"
                    db.flush()
                    bud_repo.add_history(bud.id, old_status, "wilting", "자동: 오랜 활동 없음")
                    notif_repo.push(
                        user_id,
                        "bud_wilting",
                        {"bud_id": bud.id, "title": bud.title},
                    )

            # 2) wilting 상태에서 rot_disappear_days 경과 → rot
            rot_cutoff = now - timedelta(days=rot_disappear_days)
            wilting_stmt = select(Bud).where(
                Bud.user_id == user_id,
                Bud.status == "wilting",
            )
            for bud in db.scalars(wilting_stmt).all():
                last = bud.last_progress_at or bud.created_at
                if last <= rot_cutoff:
                    bud.status = "rot"
                    bud.disappeared_at = now
                    db.flush()
                    bud_repo.add_history(bud.id, "wilting", "rot", "자동: 소멸")
                    notif_repo.push(
                        user_id,
                        "bud_rot",
                        {"bud_id": bud.id, "title": bud.title},
                    )

        # 3) 마감일 경보
        warn_date = today + timedelta(days=deadline_warn_days)
        deadline_stmt = select(Bud).where(
            Bud.user_id == user_id,
            Bud.status.in_(["seed", "bud", "flower", "fruit", "wilting"]),
            Bud.deadline != None,  # noqa: E711
            Bud.deadline <= warn_date,
            Bud.deadline >= today,
        )
        for bud in db.scalars(deadline_stmt).all():
            notif_repo.push(
                user_id,
                "deadline_warning",
                {
                    "bud_id": bud.id,
                    "title": bud.title,
                    "deadline": str(bud.deadline),
                },
            )

        db.commit()

