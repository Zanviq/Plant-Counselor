from __future__ import annotations
import base64
import hashlib

from cryptography.fernet import Fernet
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models.user import User
from app.repositories.user_repo import UserRepository
from app.repositories.garden_state_repo import GardenStateRepository


def _make_fernet() -> Fernet:
    """Derive a Fernet key from KEY_ENCRYPTION_SECRET."""
    raw = settings.key_encryption_secret.encode()
    key = base64.urlsafe_b64encode(hashlib.sha256(raw).digest())
    return Fernet(key)


class UserService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._user_repo = UserRepository(db)
        self._garden_repo = GardenStateRepository(db)

    # ── Profile management ───────────────────────────────────────────────

    def get_me(self, user_id: str) -> User:
        user = self._user_repo.get_by_id(user_id)
        if user is None:
            raise ValueError(f"사용자를 찾을 수 없습니다: {user_id}")
        return user

    def update_profile(self, user_id: str, fields: dict) -> User:
        forbidden = {"id", "email", "created_at"}
        safe_fields = {k: v for k, v in fields.items() if k not in forbidden and v is not None}
        user = self._user_repo.update(user_id, safe_fields)
        if user is None:
            raise ValueError(f"사용자를 찾을 수 없습니다: {user_id}")
        self.db.commit()
        self.db.refresh(user)
        return user

    def delete_account(self, user_id: str) -> bool:
        """Delete all user data. The auth.users entry is managed by Supabase."""
        from app.repositories.plant_repo import PlantRepository
        from app.repositories.bud_repo import BudRepository

        # Delete in dependency order
        # 1. buds + bud_history (cascade via DB FK)
        bud_repo = BudRepository(self.db)
        for bud in bud_repo.list(user_id):
            self.db.delete(bud)

        # 2. plants
        plant_repo = PlantRepository(self.db)
        for plant in plant_repo.list(user_id):
            self.db.delete(plant)

        # 3. conversations + messages (cascade via DB FK)
        from app.repositories.conversation_repo import ConversationRepository
        for conv in ConversationRepository(self.db).list_conversations(user_id):
            self.db.delete(conv)

        # 4. garden state
        gs = self._garden_repo.get_or_create(user_id)
        if gs:
            self.db.delete(gs)

        # 5. notifications
        from app.db.models.notification import Notification
        from sqlalchemy import select
        notifs = self.db.scalars(select(Notification).where(Notification.user_id == user_id)).all()
        for n in notifs:
            self.db.delete(n)

        # 6. profile
        self._user_repo.delete(user_id)
        self.db.commit()
        return True

    # ── API key management ────────────────────────────────────────────────

    def set_api_key(self, user_id: str, api_key: str) -> None:
        fernet = _make_fernet()
        encrypted = fernet.encrypt(api_key.encode()).decode()
        self._user_repo.set_encrypted_api_key(user_id, encrypted)
        self.db.commit()

    def get_api_key(self, user_id: str) -> str | None:
        encrypted = self._user_repo.get_encrypted_api_key(user_id)
        if not encrypted:
            return None
        fernet = _make_fernet()
        return fernet.decrypt(encrypted.encode()).decode()
