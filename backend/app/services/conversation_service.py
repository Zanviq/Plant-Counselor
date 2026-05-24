from __future__ import annotations
from sqlalchemy.orm import Session

from app.db.models.conversation import ConversationMessage
from app.repositories.conversation_repo import ConversationRepository


class ConversationService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._repo = ConversationRepository(db)

    def append(
        self,
        user_id: str,
        scope: str,
        scope_id: str | None,
        role: str,
        text: str,
        skill_call: dict | None = None,
    ) -> ConversationMessage:
        conv = self._repo.get_or_create(user_id, scope, scope_id)
        msg = self._repo.add_message(conv.id, role, text, skill_call)
        self.db.commit()
        self.db.refresh(msg)
        return msg

    def get_history(
        self,
        user_id: str,
        scope: str,
        scope_id: str | None,
        limit: int = 20,
    ) -> list[ConversationMessage]:
        return self._repo.get_history(user_id, scope, scope_id, limit)

    def search(
        self,
        user_id: str,
        query: str,
        scope: str,
        scope_id: str | None,
        limit: int = 10,
    ) -> list[ConversationMessage]:
        return self._repo.search(user_id, query, scope, scope_id, limit)

