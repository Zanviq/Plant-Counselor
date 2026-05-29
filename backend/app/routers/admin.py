"""Admin router — all endpoints require admin role.

Provides:
  - User management (list, role update, detail)
  - Aggregate stats (users, AI calls, plants/buds)
  - AI chat log browser (reads JSON files from backend/logs/chat/)
  - Notification dispatch (send to any user)
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client
from ulid import ULID

from app.deps import get_db, require_admin

router = APIRouter(prefix="/admin", tags=["admin"])

LOG_DIR = Path(__file__).parent.parent.parent / "logs" / "chat"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _all_users(db: Client) -> list[dict]:
    res = db.table("profiles").select("*").order("created_at", desc=False).execute()
    return res.data or []


def _count_for_user(db: Client, table: str, user_id: str) -> int:
    res = db.table(table).select("id", count="exact").eq("user_id", user_id).execute()
    return res.count or 0


def _log_files() -> list[Path]:
    if not LOG_DIR.exists():
        return []
    return sorted(LOG_DIR.glob("*.json"), reverse=True)


def _parse_log_meta(path: Path) -> dict:
    """Extract light metadata from a log file without reading the whole file."""
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        skill_calls = data.get("skill_calls", [])
        llm_calls = data.get("llm_calls", [])
        # Rough token estimate: 4 chars ≈ 1 token for each message text
        token_est = sum(
            len(str(m.get("content", "")))
            for call in llm_calls
            for m in call.get("messages", [])
        ) // 4
        return {
            "filename": path.name,
            "timestamp": data.get("timestamp"),
            "user_id": data.get("user_id"),
            "user_input": (data.get("user_input") or "")[:100],
            "llm_call_count": len(llm_calls),
            "skill_call_count": len(skill_calls),
            "skill_names": [s.get("name") for s in skill_calls],
            "token_estimate": token_est,
        }
    except Exception:
        return {"filename": path.name, "error": "parse error"}


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(admin=Depends(require_admin), db: Client = Depends(get_db)):
    """Overall service statistics."""
    users = _all_users(db)
    total_users = len(users)
    admin_count = sum(1 for u in users if u.get("role") == "admin")

    # Plant / bud counts across all users
    plants_res = db.table("plants").select("id", count="exact").execute()
    buds_res = db.table("buds").select("id", count="exact").execute()

    # Log file counts (proxy for AI sessions)
    logs = _log_files()
    total_sessions = len(logs)

    # Sessions in last 7 days
    cutoff = (datetime.utcnow() - timedelta(days=7)).isoformat()
    recent_sessions = sum(1 for p in logs if p.stem[:15] >= cutoff[:15].replace("-", "").replace("T", "_").replace(":", ""))

    # Per-user session counts from log filenames
    user_session_counts: dict[str, int] = {}
    for p in logs:
        # filename: YYYYMMDD_HHMMSS_XXX_<user_id_8chars>.json
        parts = p.stem.split("_")
        if len(parts) >= 4:
            uid_prefix = parts[3]
            user_session_counts[uid_prefix] = user_session_counts.get(uid_prefix, 0) + 1

    # Token estimate across all logs
    total_tokens = 0
    for p in logs:
        try:
            meta = _parse_log_meta(p)
            total_tokens += meta.get("token_estimate", 0)
        except Exception:
            pass

    return {
        "ok": True,
        "data": {
            "total_users": total_users,
            "admin_count": admin_count,
            "total_plants": plants_res.count or 0,
            "total_buds": buds_res.count or 0,
            "total_ai_sessions": total_sessions,
            "recent_ai_sessions_7d": recent_sessions,
            "total_token_estimate": total_tokens,
        },
    }


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users")
def list_users(admin=Depends(require_admin), db: Client = Depends(get_db)):
    """All users with plant/bud counts."""
    users = _all_users(db)

    # Log files → per-user session counts (by user_id prefix in filename)
    log_counts: dict[str, int] = {}
    for p in _log_files():
        parts = p.stem.split("_")
        if len(parts) >= 4:
            log_counts[parts[3]] = log_counts.get(parts[3], 0) + 1

    result = []
    for u in users:
        uid = u["id"]
        uid8 = uid[:8]
        plant_count = _count_for_user(db, "plants", uid)
        bud_count = _count_for_user(db, "buds", uid)
        result.append({
            **u,
            "plant_count": plant_count,
            "bud_count": bud_count,
            "ai_session_count": log_counts.get(uid8, 0),
        })
    return {"ok": True, "data": {"items": result}}


@router.get("/users/{user_id}")
def get_user_detail(user_id: str, admin=Depends(require_admin), db: Client = Depends(get_db)):
    """Full detail for one user: profile + plants + buds + conversations."""
    profile_res = db.table("profiles").select("*").eq("id", user_id).limit(1).execute()
    if not profile_res.data:
        raise HTTPException(404, "사용자를 찾을 수 없습니다.")

    plants_res = db.table("plants").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    buds_res = db.table("buds").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    convs_res = db.table("conversations").select("*").eq("user_id", user_id).execute()

    # Token estimate from logs
    uid8 = user_id[:8]
    user_logs = [p for p in _log_files() if uid8 in p.stem]
    token_total = sum(_parse_log_meta(p).get("token_estimate", 0) for p in user_logs)

    return {
        "ok": True,
        "data": {
            "profile": profile_res.data[0],
            "plants": plants_res.data or [],
            "buds": buds_res.data or [],
            "conversation_count": len(convs_res.data or []),
            "ai_session_count": len(user_logs),
            "token_estimate": token_total,
        },
    }


class RoleUpdate(BaseModel):
    role: str  # "user" | "admin"


@router.patch("/users/{user_id}/role")
def update_user_role(user_id: str, body: RoleUpdate, admin=Depends(require_admin), db: Client = Depends(get_db)):
    """Grant or revoke admin role."""
    if body.role not in ("user", "admin"):
        raise HTTPException(400, "role은 'user' 또는 'admin'이어야 합니다.")
    res = db.table("profiles").update({"role": body.role}).eq("id", user_id).execute()
    if not res.data:
        raise HTTPException(404, "사용자를 찾을 수 없습니다.")
    return {"ok": True, "data": res.data[0]}


class ProfileOverride(BaseModel):
    nickname: str | None = None
    tone: str | None = None
    ai_model: str | None = None
    garden_rules: dict[str, Any] | None = None


@router.patch("/users/{user_id}/settings")
def override_user_settings(user_id: str, body: ProfileOverride, admin=Depends(require_admin), db: Client = Depends(get_db)):
    """Admin override of user profile fields."""
    fields = body.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(400, "변경할 필드가 없습니다.")
    res = db.table("profiles").update(fields).eq("id", user_id).execute()
    if not res.data:
        raise HTTPException(404, "사용자를 찾을 수 없습니다.")
    return {"ok": True, "data": res.data[0]}


# ── AI Logs ───────────────────────────────────────────────────────────────────

@router.get("/logs")
def list_logs(
    user_id: str | None = None,
    date: str | None = None,  # YYYYMMDD
    limit: int = 50,
    offset: int = 0,
    admin=Depends(require_admin),
):
    """List AI chat log files with metadata."""
    logs = _log_files()

    # Filter by user_id prefix
    if user_id:
        uid8 = user_id[:8]
        logs = [p for p in logs if uid8 in p.stem]

    # Filter by date prefix
    if date:
        logs = [p for p in logs if p.stem.startswith(date)]

    total = len(logs)
    page = logs[offset : offset + limit]
    items = [_parse_log_meta(p) for p in page]

    return {"ok": True, "data": {"total": total, "items": items}}


@router.get("/logs/{filename}")
def get_log_detail(filename: str, admin=Depends(require_admin)):
    """Full content of one AI chat log file."""
    # Sanitize filename
    if "/" in filename or ".." in filename or not filename.endswith(".json"):
        raise HTTPException(400, "유효하지 않은 파일명입니다.")
    path = LOG_DIR / filename
    if not path.exists():
        raise HTTPException(404, "로그 파일을 찾을 수 없습니다.")
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return {"ok": True, "data": data}
    except Exception as e:
        raise HTTPException(500, f"로그 읽기 실패: {e}")


# ── Notifications ─────────────────────────────────────────────────────────────

class NotificationSend(BaseModel):
    user_ids: list[str]  # empty list = broadcast to all
    kind: str = "admin_message"
    message: str
    payload: dict[str, Any] = {}


@router.post("/notifications")
def send_notifications(body: NotificationSend, admin=Depends(require_admin), db: Client = Depends(get_db)):
    """Send notifications to specified users (or all if user_ids is empty)."""
    if not body.message.strip():
        raise HTTPException(400, "메시지를 입력해주세요.")

    target_ids = body.user_ids
    if not target_ids:
        users = _all_users(db)
        target_ids = [u["id"] for u in users]

    rows = [
        {
            "id": str(ULID()),
            "user_id": uid,
            "kind": body.kind,
            "payload": {**body.payload, "message": body.message, "from_admin": True},
        }
        for uid in target_ids
    ]
    db.table("notifications").insert(rows).execute()
    return {"ok": True, "data": {"sent_to": len(rows)}}


@router.get("/notifications/history")
def get_notification_history(limit: int = 100, admin=Depends(require_admin), db: Client = Depends(get_db)):
    """Recent admin-sent notifications."""
    res = (
        db.table("notifications")
        .select("*")
        .contains("payload", {"from_admin": True})
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return {"ok": True, "data": {"items": res.data or []}}
