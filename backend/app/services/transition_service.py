"""TransitionService: scheduler calls this periodically to handle
wilting → rot transitions and deadline warning notifications.
"""
from __future__ import annotations
from datetime import timedelta

from supabase import Client

import app.runtime_settings as rs
from app.repositories.bud_repo import BudRepository
from app.repositories.notification_repo import NotificationRepository


class TransitionService:
    def scan_all(self, db: Client) -> None:
        res = db.table("profiles").select("id,garden_rules").execute()
        for row in (res.data or []):
            self.scan_user(db, row["id"], row.get("garden_rules") or {})

    def scan_user(self, db: Client, user_id: str, garden_rules: dict | None = None) -> None:
        rules = garden_rules or {}
        wilting_days: int = rules.get("wilting_days", rs.get("default_wilting_days", 7))
        rot_disappear_days: int = rules.get("rot_disappear_days", rs.get("default_rot_disappear_days", 14))
        deadline_warn_days: int = rules.get("deadline_warn_days", rs.get("default_deadline_warn_days", 3))
        auto_transition: bool = rules.get("auto_transition", rs.get("default_auto_transition", True))

        bud_repo = BudRepository(db)
        notif_repo = NotificationRepository(db)
        # Use the time-travel-aware now/today
        now = rs.now()
        today = rs.today()

        if auto_transition:
            wilting_cutoff = (now - timedelta(days=wilting_days)).isoformat()
            # Keep seed in scans until migration 004 has promoted historical rows.
            active_buds = bud_repo.list(
                user_id, statuses=["seed", "bud", "flower", "fruit"], limit=200
            )
            for bud in active_buds:
                last_raw = getattr(bud, "last_progress_at", None) or getattr(bud, "created_at", None)
                last = last_raw if isinstance(last_raw, str) else (last_raw.isoformat() if last_raw else now.isoformat())
                if last <= wilting_cutoff:
                    bud_repo.update(user_id, bud.id, {
                        "status": "wilting",
                        "last_progress_at": now.isoformat(),
                    })
                    bud_repo.add_history(bud.id, bud.status, "wilting", "자동: 오랜 활동 없음")
                    notif_repo.push(user_id, "bud_wilting", {"bud_id": bud.id, "title": bud.title})

            rot_cutoff = (now - timedelta(days=rot_disappear_days)).isoformat()
            wilting_buds = bud_repo.list(user_id, statuses=["wilting"], limit=200)
            for bud in wilting_buds:
                last_raw = getattr(bud, "last_progress_at", None) or getattr(bud, "created_at", None)
                last = last_raw if isinstance(last_raw, str) else (last_raw.isoformat() if last_raw else now.isoformat())
                if last <= rot_cutoff:
                    bud_repo.update(user_id, bud.id, {
                        "status": "rot",
                        "disappeared_at": now.isoformat(),
                    })
                    bud_repo.add_history(bud.id, "wilting", "rot", "자동: 소멸")
                    notif_repo.push(user_id, "bud_rot", {"bud_id": bud.id, "title": bud.title})

        today_str = today.isoformat()
        # Keep seed in scans until migration 004 has promoted historical rows.
        deadline_buds = bud_repo.list(
            user_id,
            statuses=["seed", "bud", "flower", "fruit", "wilting"],
            deadline_within_days=deadline_warn_days,
            limit=200,
        )
        for bud in deadline_buds:
            dl = getattr(bud, "deadline", None)
            if dl and str(dl)[:10] >= today_str:
                # Avoid re-notifying the same bud every scan (deadline doesn't
                # change state, so it would otherwise pile up each interval).
                if notif_repo.has_unacked(user_id, "deadline_warning", bud.id):
                    continue
                notif_repo.push(user_id, "deadline_warning", {
                    "bud_id": bud.id,
                    "title": bud.title,
                    "deadline": str(dl),
                })
