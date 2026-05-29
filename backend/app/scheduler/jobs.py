from __future__ import annotations
from apscheduler.schedulers.background import BackgroundScheduler

import app.runtime_settings as rs

scheduler = BackgroundScheduler()


def setup_scheduler() -> BackgroundScheduler:
    interval = rs.get("scheduler_interval_minutes", 10)

    @scheduler.scheduled_job("interval", minutes=interval, id="transition_scan")
    def transition_scan():
        from app.services.transition_service import TransitionService
        from app.db.supa import get_client
        db = get_client()
        TransitionService().scan_all(db)

    scheduler.start()
    return scheduler
