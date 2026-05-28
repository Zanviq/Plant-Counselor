from __future__ import annotations
from sqlalchemy import func, select
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

    def list_conversations_for_user(self, user_id: str) -> list[dict]:
        """Return all conversations for a user with message counts and last-message preview.

        Executes 3 queries (conversations → counts → last messages) to avoid N+1.
        Conversations with zero messages are omitted — they are phantom rows created
        by get_or_create() and carry no history value.
        """
        # 1. All conversations for this user
        convs_stmt = (
            select(Conversation)
            .where(Conversation.user_id == user_id)
            .order_by(Conversation.updated_at.desc())
        )
        convs = list(self.db.scalars(convs_stmt).all())
        if not convs:
            return []

        conv_ids = [c.id for c in convs]

        # 2. Message count per conversation
        count_stmt = (
            select(
                ConversationMessage.conversation_id,
                func.count(ConversationMessage.id).label("cnt"),
            )
            .where(ConversationMessage.conversation_id.in_(conv_ids))
            .group_by(ConversationMessage.conversation_id)
        )
        counts: dict[str, int] = {
            row.conversation_id: row.cnt
            for row in self.db.execute(count_stmt).all()
        }

        # 3. Last user/assistant message per conversation
        #    Use a subquery for the max timestamp, then join to fetch the text.
        max_at_sub = (
            select(
                ConversationMessage.conversation_id,
                func.max(ConversationMessage.at).label("max_at"),
            )
            .where(
                ConversationMessage.conversation_id.in_(conv_ids),
                ConversationMessage.role.in_(["user", "assistant"]),
            )
            .group_by(ConversationMessage.conversation_id)
            .subquery()
        )
        last_msgs_stmt = (
            select(ConversationMessage)
            .join(
                max_at_sub,
                (ConversationMessage.conversation_id == max_at_sub.c.conversation_id)
                & (ConversationMessage.at == max_at_sub.c.max_at),
            )
            .where(ConversationMessage.role.in_(["user", "assistant"]))
        )
        last_msgs: dict[str, ConversationMessage] = {}
        for msg in self.db.scalars(last_msgs_stmt).all():
            last_msgs[msg.conversation_id] = msg

        result = []
        for conv in convs:
            cnt = counts.get(conv.id, 0)
            if cnt == 0:
                continue  # skip phantom conversations with no messages
            last = last_msgs.get(conv.id)
            result.append(
                {
                    "id": conv.id,
                    "scope": conv.scope,
                    "scope_id": conv.scope_id,
                    "message_count": cnt,
                    "last_message": (last.text[:120] if last else None),
                    "last_role": (last.role if last else None),
                    "updated_at": conv.updated_at.isoformat(),
                    "created_at": conv.created_at.isoformat(),
                }
            )
        return result

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

