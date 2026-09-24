from __future__ import annotations
import logging
from pathlib import Path
from types import SimpleNamespace

from app.db.pg import Client

from app.repositories.user_repo import UserRepository
from app.repositories.garden_state_repo import GardenStateRepository

logger = logging.getLogger(__name__)

LOG_DIR = Path(__file__).parent.parent.parent / "logs" / "chat"


def _delete_user_logs(user_id: str) -> int:
    """Delete all AI chat log files for the given user. Returns count."""
    if not LOG_DIR.exists():
        return 0
    uid8 = user_id[:8]
    deleted = 0
    for path in LOG_DIR.glob("*.json"):
        if uid8 in path.stem:
            try:
                path.unlink()
                deleted += 1
            except Exception as e:
                logger.warning("Could not delete log %s: %s", path.name, e)
    return deleted


class UserService:
    def __init__(self, db: Client) -> None:
        self.db = db
        self._user_repo = UserRepository(db)
        self._garden_repo = GardenStateRepository(db)

    def get_me(self, user_id: str) -> SimpleNamespace:
        user = self._user_repo.get_by_id(user_id)
        if user is None:
            raise ValueError(f"사용자를 찾을 수 없습니다: {user_id}")
        return user

    def update_profile(self, user_id: str, fields: dict) -> SimpleNamespace:
        forbidden = {"id", "username", "password_hash", "role", "created_at"}
        safe_fields = {k: v for k, v in fields.items() if k not in forbidden and v is not None}
        user = self._user_repo.update(user_id, safe_fields)
        if user is None:
            raise ValueError(f"사용자를 찾을 수 없습니다: {user_id}")
        return user

    def delete_account(self, user_id: str) -> dict:
        """Delete ALL data for a user.

        Cascade order (FK constraints):
          buds → bud_history (CASCADE on bud_id)
          plants → buds (CASCADE on plant_id, so deleting plants also cascades buds→bud_history)
          conversations → conversation_messages (CASCADE on conversation_id)

        Strategy: bulk delete by user_id directly — no row-level loops,
        no limit issues, no missed archived/dormant rows.
        """
        deleted: dict[str, int] = {}

        # 1. Buds first (covers bud_history via CASCADE)
        r = self.db.table("buds").delete().eq("user_id", user_id).execute()
        deleted["buds"] = len(r.data or [])

        # 2. Plants (all statuses including archived)
        r = self.db.table("plants").delete().eq("user_id", user_id).execute()
        deleted["plants"] = len(r.data or [])

        # 3. Conversations (covers conversation_messages via CASCADE)
        r = self.db.table("conversations").delete().eq("user_id", user_id).execute()
        deleted["conversations"] = len(r.data or [])

        # 4. Garden state
        self.db.table("garden_state").delete().eq("user_id", user_id).execute()

        # 5. Notifications
        r = self.db.table("notifications").delete().eq("user_id", user_id).execute()
        deleted["notifications"] = len(r.data or [])

        # 6. AI chat log files
        deleted["log_files"] = _delete_user_logs(user_id)

        # 7. User row (credentials + profile)
        self._user_repo.delete(user_id)

        logger.info("Account deleted: %s — %s", user_id[:8], deleted)
        return deleted
