from __future__ import annotations
from types import SimpleNamespace

from supabase import Client


def _row(d: dict | None) -> SimpleNamespace | None:
    return SimpleNamespace(**d) if d else None


class UserRepository:
    def __init__(self, db: Client) -> None:
        self.db = db

    def get_by_id(self, user_id: str) -> SimpleNamespace | None:
        res = self.db.table("profiles").select("*").eq("id", user_id).maybe_single().execute()
        return _row(res.data)

    def create_profile(self, user_id: str, email: str, nickname: str) -> SimpleNamespace:
        row = {"id": user_id, "email": email, "nickname": nickname}
        res = self.db.table("profiles").insert(row).execute()
        return _row(res.data[0])

    def update(self, user_id: str, fields: dict) -> SimpleNamespace | None:
        res = self.db.table("profiles").update(fields).eq("id", user_id).execute()
        return _row(res.data[0]) if res.data else None

    def delete(self, user_id: str) -> None:
        self.db.table("profiles").delete().eq("id", user_id).execute()

    def set_encrypted_api_key(self, user_id: str, encrypted_key: str) -> None:
        self.db.table("profiles").update({"encrypted_api_key": encrypted_key}).eq("id", user_id).execute()

    def get_encrypted_api_key(self, user_id: str) -> str | None:
        res = self.db.table("profiles").select("encrypted_api_key").eq("id", user_id).maybe_single().execute()
        return res.data.get("encrypted_api_key") if res.data else None
