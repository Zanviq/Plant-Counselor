from __future__ import annotations
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.user import User


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, user_id: str) -> User | None:
        stmt = select(User).where(User.id == user_id)
        return self.db.scalar(stmt)

    def create_profile(self, user_id: str, email: str, nickname: str) -> User:
        """Create a new profile from Supabase Auth user data."""
        user = User(id=user_id, email=email, nickname=nickname)
        self.db.add(user)
        self.db.flush()
        return user

    def update(self, user_id: str, fields: dict) -> User | None:
        user = self.get_by_id(user_id)
        if user is None:
            return None
        for key, value in fields.items():
            setattr(user, key, value)
        self.db.flush()
        return user

    def delete(self, user_id: str) -> None:
        user = self.get_by_id(user_id)
        if user is not None:
            self.db.delete(user)
            self.db.flush()

    def set_encrypted_api_key(self, user_id: str, encrypted_key: str) -> None:
        user = self.get_by_id(user_id)
        if user is not None:
            user.encrypted_api_key = encrypted_key
            self.db.flush()

    def get_encrypted_api_key(self, user_id: str) -> str | None:
        user = self.get_by_id(user_id)
        if user is None:
            return None
        return user.encrypted_api_key
