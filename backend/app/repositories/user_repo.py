from __future__ import annotations
from types import SimpleNamespace

from ulid import ULID

from app.db.pg import Client

# Columns safe to return from APIs (everything except password_hash).
PUBLIC_COLUMNS = (
    "id,username,email,nickname,role,tone,ai_model,garden_rules,appearance,created_at,updated_at"
)


def _row(d: dict | None) -> SimpleNamespace | None:
    return SimpleNamespace(**d) if d else None


class UserRepository:
    def __init__(self, db: Client) -> None:
        self.db = db

    def get_by_id(self, user_id: str) -> SimpleNamespace | None:
        res = self.db.table("users").select(PUBLIC_COLUMNS).eq("id", user_id).limit(1).execute()
        return _row(res.data[0]) if res.data else None

    def get_credentials(self, username: str) -> dict | None:
        """Return {id, password_hash} for login. Never expose this row."""
        res = (
            self.db.table("users")
            .select("id,password_hash")
            .eq("username", username)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def username_exists(self, username: str) -> bool:
        res = self.db.table("users").select("id").eq("username", username).limit(1).execute()
        return bool(res.data)

    def create(self, username: str, password_hash: str, nickname: str, email: str | None = None) -> SimpleNamespace:
        row = {
            "id": str(ULID()),
            "username": username,
            "password_hash": password_hash,
            "nickname": nickname,
            "email": email,
        }
        self.db.table("users").insert(row).execute()
        return self.get_by_id(row["id"])  # type: ignore[return-value]

    def update(self, user_id: str, fields: dict) -> SimpleNamespace | None:
        res = self.db.table("users").update(fields).eq("id", user_id).execute()
        if not res.data:
            return None
        return self.get_by_id(user_id)

    def delete(self, user_id: str) -> None:
        self.db.table("users").delete().eq("id", user_id).execute()
