from __future__ import annotations
import base64
import hashlib

from passlib.context import CryptContext
from cryptography.fernet import Fernet
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models.user import User
from app.repositories.user_repo import UserRepository
from app.repositories.garden_state_repo import GardenStateRepository

_pwd_ctx = CryptContext(schemes=["argon2"], deprecated="auto")


def _make_fernet() -> Fernet:
    """KEY_ENCRYPTION_SECRET 을 32바이트 key로 변환해 Fernet 인스턴스를 반환합니다."""
    raw = settings.key_encryption_secret.encode()
    # SHA-256으로 32바이트 파생 후 URL-safe base64 인코딩
    key = base64.urlsafe_b64encode(hashlib.sha256(raw).digest())
    return Fernet(key)


class UserService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._user_repo = UserRepository(db)
        self._garden_repo = GardenStateRepository(db)

    # ------------------------------------------------------------------
    # 회원가입 / 인증
    # ------------------------------------------------------------------

    def signup(self, nickname: str, password: str) -> User:
        if self._user_repo.get_by_nickname(nickname) is not None:
            raise ValueError(f"이미 사용 중인 닉네임입니다: {nickname}")
        password_hash = _pwd_ctx.hash(password)
        user = self._user_repo.create(nickname, password_hash)
        # 정원 상태 초기화
        self._garden_repo.get_or_create(user.id)
        self.db.commit()
        self.db.refresh(user)
        return user

    def authenticate(self, nickname: str, password: str) -> User | None:
        user = self._user_repo.get_by_nickname(nickname)
        if user is None:
            return None
        if not _pwd_ctx.verify(password, user.password_hash):
            return None
        return user

    # ------------------------------------------------------------------
    # 프로필 조회 / 수정
    # ------------------------------------------------------------------

    def get_me(self, user_id: str) -> User:
        user = self._user_repo.get_by_id(user_id)
        if user is None:
            raise ValueError(f"사용자를 찾을 수 없습니다: {user_id}")
        return user

    def update_profile(self, user_id: str, fields: dict) -> User:
        # 변경 금지 필드 제거
        forbidden = {"id", "password_hash", "created_at"}
        safe_fields = {k: v for k, v in fields.items() if k not in forbidden and v is not None}
        user = self._user_repo.update(user_id, safe_fields)
        if user is None:
            raise ValueError(f"사용자를 찾을 수 없습니다: {user_id}")
        self.db.commit()
        self.db.refresh(user)
        return user

    def change_password(self, user_id: str, old_password: str, new_password: str) -> bool:
        user = self.get_me(user_id)
        if not _pwd_ctx.verify(old_password, user.password_hash):
            return False
        new_hash = _pwd_ctx.hash(new_password)
        self._user_repo.update(user_id, {"password_hash": new_hash})
        self.db.commit()
        return True

    def delete_account(self, user_id: str, confirm_nickname: str) -> bool:
        user = self.get_me(user_id)
        if user.nickname != confirm_nickname:
            return False
        self._user_repo.delete(user_id)
        self.db.commit()
        return True

    # ------------------------------------------------------------------
    # API 키 관리
    # ------------------------------------------------------------------

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

