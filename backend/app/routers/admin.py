"""Admin router — all endpoints require admin role.

Provides:
  - User management (list, role update, detail)
  - Aggregate stats (users, AI calls, plants/buds)
  - AI chat log browser (reads JSON files from backend/logs/chat/)
  - Notification dispatch (send to any user)
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client
from ulid import ULID

import app.runtime_settings as rs
from app.deps import get_db, require_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

LOG_DIR = Path(__file__).parent.parent.parent / "logs" / "chat"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _all_users(db: Client) -> list[dict]:
    res = db.table("profiles").select("*").order("created_at", desc=False).execute()
    return res.data or []


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

    # Sessions in last 7 days — compare YYYYMMDD prefix directly.
    cutoff_date = (datetime.utcnow() - timedelta(days=7)).strftime("%Y%m%d")
    recent_sessions = sum(1 for p in logs if p.stem[:8] >= cutoff_date)

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

    # Bulk fetch user_ids from plants/buds in two queries (vs 2*N before).
    plants_res = db.table("plants").select("user_id").execute()
    buds_res = db.table("buds").select("user_id").execute()
    plant_counts: dict[str, int] = {}
    bud_counts: dict[str, int] = {}
    for row in (plants_res.data or []):
        uid = row.get("user_id")
        if uid:
            plant_counts[uid] = plant_counts.get(uid, 0) + 1
    for row in (buds_res.data or []):
        uid = row.get("user_id")
        if uid:
            bud_counts[uid] = bud_counts.get(uid, 0) + 1

    result = []
    for u in users:
        uid = u["id"]
        result.append({
            **u,
            "plant_count": plant_counts.get(uid, 0),
            "bud_count": bud_counts.get(uid, 0),
            "ai_session_count": log_counts.get(uid[:8], 0),
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


# ── Controller ────────────────────────────────────────────────────────────────

@router.get("/controller/settings")
def get_controller_settings(admin=Depends(require_admin)):
    """Return all runtime settings with their current values and defaults."""
    current = rs.get_all()
    result = {
        k: {
            "value": current.get(k, rs.DEFAULTS[k]),
            "default": rs.DEFAULTS[k],
            "modified": current.get(k) != rs.DEFAULTS[k],
        }
        for k in rs.DEFAULTS
    }
    return {"ok": True, "data": {"settings": result, "available_models": rs.AVAILABLE_MODELS}}


class SettingsUpdate(BaseModel):
    updates: dict[str, Any]
    persist: bool = False  # save to disk snapshot


@router.patch("/controller/settings")
def update_controller_settings(body: SettingsUpdate, admin=Depends(require_admin)):
    """Update one or more runtime settings."""
    skipped = rs.set_many(body.updates)
    if body.persist:
        rs.save_snapshot()
    return {"ok": True, "data": {"skipped": skipped, "persisted": body.persist}}


@router.post("/controller/settings/reset")
def reset_controller_settings(admin=Depends(require_admin)):
    """Reset all runtime settings to defaults."""
    rs.reset_all()
    return {"ok": True, "data": {}}


class SqlQuery(BaseModel):
    query: str
    max_rows: int = 200


@router.post("/controller/sql")
def execute_sql(body: SqlQuery, admin=Depends(require_admin), db: Client = Depends(get_db)):
    """Execute arbitrary SQL via the exec_admin_query RPC function.

    Security model: admin-only (require_admin), RPC runs SECURITY DEFINER on
    Postgres side. Every invocation is audit-logged with the admin user_id
    and the full query text so any destructive action is traceable.
    """
    if not body.query.strip():
        raise HTTPException(400, "SQL 쿼리를 입력해주세요.")
    # Audit log: admin user + query (truncated for readability if huge).
    q_preview = body.query if len(body.query) <= 500 else body.query[:500] + "...(truncated)"
    logger.warning("ADMIN_SQL_EXEC user=%s query=%r", admin.id, q_preview)
    try:
        res = db.rpc("exec_admin_query", {"sql_query": body.query}).execute()
        result = res.data
        if isinstance(result, dict) and "error" in result:
            return {"ok": False, "error": {"code": result.get("detail", "sql_error"), "message": result["error"]}}
        rows = result.get("rows", []) if isinstance(result, dict) else []
        kind = result.get("type", "select") if isinstance(result, dict) else "select"
        affected = result.get("affected", 0) if isinstance(result, dict) else 0
        return {
            "ok": True,
            "data": {
                "rows": rows[:body.max_rows] if rows else [],
                "total": len(rows) if rows else 0,
                "type": kind,
                "affected": affected,
                "truncated": len(rows) > body.max_rows if rows else False,
            },
        }
    except Exception as e:
        return {"ok": False, "error": {"code": "exec_error", "message": str(e)}}


@router.post("/controller/scheduler/trigger")
def trigger_scheduler(admin=Depends(require_admin), db: Client = Depends(get_db)):
    """Manually trigger the transition scan job."""
    from app.services.transition_service import TransitionService
    try:
        TransitionService().scan_all(db)
        return {"ok": True, "data": {"message": "전환 스캔 완료"}}
    except Exception as e:
        raise HTTPException(500, f"스캔 실패: {e}")


class UserModelUpdate(BaseModel):
    ai_model: str


@router.patch("/controller/users/{user_id}/model")
def set_user_model(user_id: str, body: UserModelUpdate, admin=Depends(require_admin), db: Client = Depends(get_db)):
    """Override the AI model for a specific user."""
    if body.ai_model not in rs.AVAILABLE_MODELS:
        raise HTTPException(400, f"지원하지 않는 모델: {body.ai_model}")
    res = db.table("profiles").update({"ai_model": body.ai_model}).eq("id", user_id).execute()
    if not res.data:
        raise HTTPException(404, "사용자를 찾을 수 없습니다.")
    return {"ok": True, "data": res.data[0]}


@router.get("/controller/tables")
def list_tables(admin=Depends(require_admin), db: Client = Depends(get_db)):
    """List all public tables with row counts."""
    tables = ["profiles", "plants", "buds", "bud_history", "garden_state",
              "conversations", "conversation_messages", "notifications"]
    result = []
    for t in tables:
        try:
            res = db.table(t).select("id", count="exact").limit(1).execute()
            result.append({"table": t, "row_count": res.count or 0})
        except Exception:
            result.append({"table": t, "row_count": None, "error": "unavailable"})
    return {"ok": True, "data": {"tables": result}}


# ── Time Travel ───────────────────────────────────────────────────────────────

@router.get("/controller/time")
def get_virtual_time(admin=Depends(require_admin)):
    """Return the current virtual server time (real time + offset)."""
    from datetime import datetime
    virt = rs.now()
    real = datetime.utcnow()
    offset_s = rs.time_offset_seconds()
    return {
        "ok": True,
        "data": {
            "virtual_now": virt.isoformat(),
            "real_now": real.isoformat(),
            "offset_seconds": offset_s,
            "offset_days": round(offset_s / 86400, 2),
            "offset_hours": round(offset_s / 3600, 2),
        },
    }


class TimeOffsetBody(BaseModel):
    offset_seconds: int | None = None   # absolute override
    add_days: float | None = None       # relative: add N days
    add_hours: float | None = None      # relative: add N hours
    reset: bool = False                 # reset to real time


@router.patch("/controller/time")
def set_virtual_time(body: TimeOffsetBody, admin=Depends(require_admin)):
    """Set the server time offset for demo/testing."""
    current = rs.time_offset_seconds()

    if body.reset:
        rs.set("time_offset_seconds", 0)
    elif body.offset_seconds is not None:
        rs.set("time_offset_seconds", body.offset_seconds)
    else:
        delta = 0
        if body.add_days is not None:
            delta += int(body.add_days * 86400)
        if body.add_hours is not None:
            delta += int(body.add_hours * 3600)
        rs.set("time_offset_seconds", current + delta)

    from datetime import datetime
    return {
        "ok": True,
        "data": {
            "virtual_now": rs.now().isoformat(),
            "offset_seconds": rs.time_offset_seconds(),
            "offset_days": round(rs.time_offset_seconds() / 86400, 2),
        },
    }


# ── Cleanup / Purge ───────────────────────────────────────────────────────────

@router.delete("/controller/users/{user_id}/conversations")
def delete_user_conversations(user_id: str, include_logs: bool = True,
                               admin=Depends(require_admin), db: Client = Depends(get_db)):
    """Delete all conversations (+ messages via CASCADE) for one user.
    Optionally also wipes the AI chat log files for that user.
    """
    conv_res = db.table("conversations").delete().eq("user_id", user_id).execute()
    deleted_convs = len(conv_res.data or [])

    deleted_logs = 0
    if include_logs and LOG_DIR.exists():
        uid8 = user_id[:8]
        for p in LOG_DIR.glob("*.json"):
            if uid8 in p.stem:
                try:
                    p.unlink()
                    deleted_logs += 1
                except Exception:
                    pass

    return {
        "ok": True,
        "data": {
            "deleted_conversations": deleted_convs,
            "deleted_log_files": deleted_logs,
        },
    }


@router.delete("/controller/conversations/all")
def delete_all_conversations(include_logs: bool = True,
                              admin=Depends(require_admin), db: Client = Depends(get_db)):
    """Delete ALL conversations and messages across all users."""
    # Delete all conversation_messages first (redundant due to CASCADE but explicit)
    db.table("conversation_messages").delete().neq("id", "").execute()
    conv_res = db.table("conversations").delete().neq("id", "").execute()
    deleted_convs = len(conv_res.data or [])

    deleted_logs = 0
    if include_logs and LOG_DIR.exists():
        for p in LOG_DIR.glob("*.json"):
            try:
                p.unlink()
                deleted_logs += 1
            except Exception:
                pass

    return {
        "ok": True,
        "data": {
            "deleted_conversations": deleted_convs,
            "deleted_log_files": deleted_logs,
        },
    }


@router.delete("/controller/logs/all")
def delete_all_log_files(admin=Depends(require_admin)):
    """Delete all AI chat log JSON files from disk (keep DB conversations)."""
    deleted = 0
    if LOG_DIR.exists():
        for p in LOG_DIR.glob("*.json"):
            try:
                p.unlink()
                deleted += 1
            except Exception:
                pass
    return {"ok": True, "data": {"deleted_log_files": deleted}}


@router.delete("/controller/users/{user_id}/account")
def admin_delete_user_account(user_id: str, admin=Depends(require_admin), db: Client = Depends(get_db)):
    """Admin-triggered full account deletion (same as user self-deletion)."""
    from app.services.user_service import UserService
    deleted = UserService(db).delete_account(user_id)
    return {"ok": True, "data": {"deleted": deleted}}


# ── Granular / single-item deletion ──────────────────────────────────────────

@router.get("/data/users/{user_id}/conversations")
def get_user_conversations(user_id: str, admin=Depends(require_admin), db: Client = Depends(get_db)):
    """List all conversations for a user with message count."""
    convs = db.table("conversations").select("*").eq("user_id", user_id).order("updated_at", desc=True).execute()
    convs_data = convs.data or []
    if not convs_data:
        return {"ok": True, "data": {"items": []}}

    # Bulk fetch all messages for these conversations in one query (vs N).
    conv_ids = [c["id"] for c in convs_data]
    msgs_res = db.table("conversation_messages").select("conversation_id").in_("conversation_id", conv_ids).execute()
    counts: dict[str, int] = {}
    for m in (msgs_res.data or []):
        cid = m["conversation_id"]
        counts[cid] = counts.get(cid, 0) + 1

    result = [{**c, "message_count": counts.get(c["id"], 0)} for c in convs_data]
    return {"ok": True, "data": {"items": result}}


@router.delete("/data/conversations/{conversation_id}")
def delete_conversation(conversation_id: str, admin=Depends(require_admin), db: Client = Depends(get_db)):
    """Delete a single conversation and all its messages (CASCADE)."""
    res = db.table("conversations").delete().eq("id", conversation_id).execute()
    if not res.data:
        raise HTTPException(404, "대화를 찾을 수 없습니다.")
    return {"ok": True, "data": {"deleted_id": conversation_id}}


@router.get("/data/users/{user_id}/plants")
def get_user_plants(user_id: str, admin=Depends(require_admin), db: Client = Depends(get_db)):
    """List all plants (including archived) for a user."""
    res = db.table("plants").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    plants_data = res.data or []
    if not plants_data:
        return {"ok": True, "data": {"items": []}}

    # Bulk fetch bud counts per plant in one query.
    plant_ids = [p["id"] for p in plants_data]
    buds_res = db.table("buds").select("plant_id").in_("plant_id", plant_ids).execute()
    bud_counts: dict[str, int] = {}
    for b in (buds_res.data or []):
        pid = b["plant_id"]
        bud_counts[pid] = bud_counts.get(pid, 0) + 1

    result = [{**p, "bud_count": bud_counts.get(p["id"], 0)} for p in plants_data]
    return {"ok": True, "data": {"items": result}}


@router.delete("/data/plants/{plant_id}")
def delete_plant(plant_id: str, admin=Depends(require_admin), db: Client = Depends(get_db)):
    """Delete a plant and all its buds + history (CASCADE)."""
    # buds.plant_id → plants CASCADE
    res = db.table("plants").delete().eq("id", plant_id).execute()
    if not res.data:
        raise HTTPException(404, "식물을 찾을 수 없습니다.")
    return {"ok": True, "data": {"deleted_id": plant_id}}


@router.get("/data/users/{user_id}/buds")
def get_user_buds(user_id: str, admin=Depends(require_admin), db: Client = Depends(get_db)):
    """List all buds for a user."""
    res = db.table("buds").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    return {"ok": True, "data": {"items": res.data or []}}


@router.delete("/data/buds/{bud_id}")
def delete_bud(bud_id: str, admin=Depends(require_admin), db: Client = Depends(get_db)):
    """Delete a single bud and its history (CASCADE)."""
    res = db.table("buds").delete().eq("id", bud_id).execute()
    if not res.data:
        raise HTTPException(404, "봉우리를 찾을 수 없습니다.")
    return {"ok": True, "data": {"deleted_id": bud_id}}
