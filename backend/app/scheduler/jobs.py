from __future__ import annotations
from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()


def setup_scheduler() -> BackgroundScheduler:
    @scheduler.scheduled_job("interval", minutes=10, id="transition_scan")
    def transition_scan():
        from app.services.transition_service import TransitionService
        from app.db.supa import get_client
        db = get_client()
        TransitionService().scan_all(db)

    scheduler.start()
    return scheduler
