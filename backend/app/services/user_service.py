from __future__ import annotations
import base64
import hashlib
from types import SimpleNamespace

from cryptography.fernet import Fernet
from supabase import Client

from app.config import settings
from app.repositories.user_repo import UserRepository
from app.repositories.garden_state_repo import GardenStateRepository


def _make_fernet() -> Fernet:
    raw = settings.key_encryption_secret.encode()
    key = base64.urlsafe_b64encode(hashlib.sha256(raw).digest())
    return Fernet(key)


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
        forbidden = {"id", "email", "created_at"}
        safe_fields = {k: v for k, v in fields.items() if k not in forbidden and v is not None}
        user = self._user_repo.update(user_id, safe_fields)
        if user is None:
            raise ValueError(f"사용자를 찾을 수 없습니다: {user_id}")
        return user

    def delete_account(self, user_id: str) -> bool:
        from app.repositories.plant_repo import PlantRepository
        from app.repositories.bud_repo import BudRepository
        from app.repositories.conversation_repo import ConversationRepository

        bud_repo = BudRepository(self.db)
        for bud in bud_repo.list(user_id):
            self.db.table("buds").delete().eq("id", bud.id).execute()

        plant_repo = PlantRepository(self.db)
        for plant in plant_repo.list(user_id):
            self.db.table("plants").delete().eq("id", plant.id).execute()

        for conv in ConversationRepository(self.db).list_conversations(user_id):
            self.db.table("conversations").delete().eq("id", conv.id).execute()

        self.db.table("garden_state").delete().eq("user_id", user_id).execute()
        self.db.table("notifications").delete().eq("user_id", user_id).execute()
        self._user_repo.delete(user_id)
        return True

    def set_api_key(self, user_id: str, api_key: str) -> None:
        fernet = _make_fernet()
        encrypted = fernet.encrypt(api_key.encode()).decode()
        self._user_repo.set_encrypted_api_key(user_id, encrypted)

    def get_api_key(self, user_id: str) -> str | None:
        encrypted = self._user_repo.get_encrypted_api_key(user_id)
        if not encrypted:
            return None
        fernet = _make_fernet()
        return fernet.decrypt(encrypted.encode()).decode()
