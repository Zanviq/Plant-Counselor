from __future__ import annotations
from types import SimpleNamespace

from supabase import Client

from app.repositories.conversation_repo import ConversationRepository


class ConversationService:
    def __init__(self, db: Client) -> None:
        self.db = db
        self._repo = ConversationRepository(db)

    def append(self, user_id: str, scope: str, scope_id: str | None,
               role: str, text: str, skill_call: dict | None = None) -> SimpleNamespace:
        conv = self._repo.get_or_create(user_id, scope, scope_id)
        return self._repo.add_message(conv.id, role, text, skill_call)

    def get_history(self, user_id: str, scope: str, scope_id: str | None,
                    limit: int = 20) -> list[SimpleNamespace]:
        return self._repo.get_history(user_id, scope, scope_id, limit)

    def list_conversations(self, user_id: str) -> list[dict]:
        return self._repo.list_conversations_for_user(user_id)

    def search(self, user_id: str, query: str, scope: str, scope_id: str | None,
               limit: int = 10) -> list[SimpleNamespace]:
        return self._repo.search(user_id, query, scope, scope_id, limit)
