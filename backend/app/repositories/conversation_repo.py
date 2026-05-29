from __future__ import annotations
from types import SimpleNamespace

from supabase import Client
from ulid import ULID


def _row(d: dict | None) -> SimpleNamespace | None:
    return SimpleNamespace(**d) if d else None


def _rows(lst: list[dict]) -> list[SimpleNamespace]:
    return [SimpleNamespace(**d) for d in lst]


class ConversationRepository:
    def __init__(self, db: Client) -> None:
        self.db = db

    def get_or_create(
        self,
        user_id: str,
        scope: str,
        scope_id: str | None = None,
    ) -> SimpleNamespace:
        q = (
            self.db.table("conversations")
            .select("*")
            .eq("user_id", user_id)
            .eq("scope", scope)
        )
        if scope_id is None:
            q = q.is_("scope_id", "null")
        else:
            q = q.eq("scope_id", scope_id)
        res = q.limit(1).execute()
        if res.data:
            return _row(res.data[0])
        row = {"id": str(ULID()), "user_id": user_id, "scope": scope, "scope_id": scope_id}
        ins = self.db.table("conversations").insert(row).execute()
        return _row(ins.data[0])

    def add_message(
        self,
        conversation_id: str,
        role: str,
        text: str,
        skill_call: dict | None = None,
    ) -> SimpleNamespace:
        row = {
            "id": str(ULID()),
            "conversation_id": conversation_id,
            "role": role,
            "text": text,
            "skill_call": skill_call,
        }
        res = self.db.table("conversation_messages").insert(row).execute()
        return _row(res.data[0])

    def get_history(
        self,
        user_id: str,
        scope: str,
        scope_id: str | None,
        limit: int = 20,
    ) -> list[SimpleNamespace]:
        conv = self.get_or_create(user_id, scope, scope_id)
        res = (
            self.db.table("conversation_messages")
            .select("*")
            .eq("conversation_id", conv.id)
            .order("at", desc=True)
            .limit(limit)
            .execute()
        )
        rows = _rows(res.data or [])
        return list(reversed(rows))

    def list_conversations_for_user(self, user_id: str) -> list[dict]:
        convs_res = (
            self.db.table("conversations")
            .select("*")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .execute()
        )
        convs = convs_res.data or []
        if not convs:
            return []

        conv_ids = [c["id"] for c in convs]

        # Fetch messages for all conversations in one call
        msgs_res = (
            self.db.table("conversation_messages")
            .select("*")
            .in_("conversation_id", conv_ids)
            .in_("role", ["user", "assistant"])
            .execute()
        )
        msgs = msgs_res.data or []

        # Build counts and last-message maps
        counts: dict[str, int] = {}
        last_msg: dict[str, dict] = {}
        for m in msgs:
            cid = m["conversation_id"]
            counts[cid] = counts.get(cid, 0) + 1
            if cid not in last_msg or m["at"] > last_msg[cid]["at"]:
                last_msg[cid] = m

        result = []
        for c in convs:
            cnt = counts.get(c["id"], 0)
            if cnt == 0:
                continue
            last = last_msg.get(c["id"])
            result.append({
                "id": c["id"],
                "scope": c["scope"],
                "scope_id": c.get("scope_id"),
                "message_count": cnt,
                "last_message": (last["text"][:120] if last else None),
                "last_role": (last["role"] if last else None),
                "updated_at": c["updated_at"],
                "created_at": c["created_at"],
            })
        return result

    def delete_by_scope(self, user_id: str, scope: str, scope_id: str | None) -> int:
        """Delete the conversation for (user, scope, scope_id) and all its
        messages (CASCADE). Returns the number of conversations removed."""
        q = (
            self.db.table("conversations")
            .delete()
            .eq("user_id", user_id)
            .eq("scope", scope)
        )
        if scope_id is None:
            q = q.is_("scope_id", "null")
        else:
            q = q.eq("scope_id", scope_id)
        res = q.execute()
        return len(res.data or [])

    def search(
        self,
        user_id: str,
        query: str,
        scope: str,
        scope_id: str | None,
        limit: int = 10,
    ) -> list[SimpleNamespace]:
        conv = self.get_or_create(user_id, scope, scope_id)
        # Escape LIKE wildcards so user input doesn't match unintended patterns.
        safe = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        res = (
            self.db.table("conversation_messages")
            .select("*")
            .eq("conversation_id", conv.id)
            .like("text", f"%{safe}%")
            .order("at", desc=True)
            .limit(limit)
            .execute()
        )
        return _rows(res.data or [])
