from __future__ import annotations
from sqlalchemy import select
from sqlalchemy.orm import Session
from ulid import ULID

from app.db.models.conversation import Conversation, ConversationMessage


class ConversationRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_or_create(
        self,
        user_id: str,
        scope: str,
        scope_id: str | None = None,
    ) -> Conversation:
        stmt = select(Conversation).where(
            Conversation.user_id == user_id,
            Conversation.scope == scope,
            Conversation.scope_id == scope_id,
        )
        conv = self.db.scalar(stmt)
        if conv is None:
            conv = Conversation(
                id=str(ULID()),
                user_id=user_id,
                scope=scope,
                scope_id=scope_id,
            )
            self.db.add(conv)
            self.db.flush()
        return conv

    def add_message(
        self,
        conversation_id: str,
        role: str,
        text: str,
        skill_call: dict | None = None,
    ) -> ConversationMessage:
        msg = ConversationMessage(
            id=str(ULID()),
            conversation_id=conversation_id,
            role=role,
            text=text,
            skill_call=skill_call,
        )
        self.db.add(msg)
        self.db.flush()
        return msg

    def get_history(
        self,
        user_id: str,
        scope: str,
        scope_id: str | None,
        limit: int = 20,
    ) -> list[ConversationMessage]:
        conv = self.get_or_create(user_id, scope, scope_id)
        stmt = (
            select(ConversationMessage)
            .where(ConversationMessage.conversation_id == conv.id)
            .order_by(ConversationMessage.at.desc())
            .limit(limit)
        )
        rows = list(self.db.scalars(stmt).all())
        return list(reversed(rows))

    def search(
        self,
        user_id: str,
        query: str,
        scope: str,
        scope_id: str | None,
        limit: int = 10,
    ) -> list[ConversationMessage]:
        conv = self.get_or_create(user_id, scope, scope_id)
        stmt = (
            select(ConversationMessage)
            .where(
                ConversationMessage.conversation_id == conv.id,
                ConversationMessage.text.like(f"%{query}%"),
            )
            .order_by(ConversationMessage.at.desc())
            .limit(limit)
        )
        return list(self.db.scalars(stmt).all())

