"""AI chat log storage — Supabase-backed with a local-file fallback.

Why this exists: AI chat logs used to be written only to ``backend/logs/chat/*.json``.
On hosts with an ephemeral disk (e.g. Render free tier) that directory is wiped on
every restart/redeploy, so the admin "AI 로그" page went empty after a day while the
real data (in Supabase) stayed intact.

Primary storage is now the Supabase ``ai_logs`` table (survives restarts). The local
JSON file is still written as a best-effort mirror for local development. All admin
reads/deletes go through this module:

- if the DB is reachable and the ``ai_logs`` table exists → DB is authoritative
- otherwise (e.g. table not created yet, or offline) → transparently fall back to files

Table DDL (run once in /admin/controller SQL 실행기):

    create table if not exists public.ai_logs (
        filename   text primary key,
        user_id    text,
        created_at timestamptz not null default now(),
        data       jsonb not null
    );
    create index if not exists ai_logs_user_id_idx on public.ai_logs (user_id);
    create index if not exists ai_logs_filename_idx on public.ai_logs (filename desc);
    -- Backend uses the service_role key (bypasses RLS); enabling RLS with no
    -- policies keeps anon/authenticated clients from reading logs via PostgREST.
    alter table public.ai_logs enable row level security;
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

LOG_DIR = Path(__file__).parent.parent.parent / "logs" / "chat"
_TABLE = "ai_logs"


# ── Write ─────────────────────────────────────────────────────────────────────

def save(db, filename: str, user_id: str, created_at: str, data: dict) -> None:
    """Persist one chat-turn log. DB first (durable); file as a local mirror."""
    wrote_db = False
    if db is not None:
        try:
            db.table(_TABLE).upsert({
                "filename": filename,
                "user_id": user_id,
                "created_at": created_at,
                "data": data,
            }).execute()
            wrote_db = True
        except Exception as e:  # table missing / network — keep the file mirror
            logger.warning("ai_logs DB save failed (%s); using file only", e)

    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        with open(LOG_DIR / filename, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    except Exception as e:
        if not wrote_db:
            logger.error("ai_logs save failed entirely (db+file): %s", e)


# ── Read ──────────────────────────────────────────────────────────────────────

def _file_rows() -> list[dict]:
    """Read every local log file into row dicts (newest first)."""
    if not LOG_DIR.exists():
        return []
    rows: list[dict] = []
    for p in sorted(LOG_DIR.glob("*.json"), reverse=True):
        try:
            with open(p, encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            data = {"_parse_error": True}
        rows.append({
            "filename": p.name,
            "user_id": data.get("user_id"),
            "created_at": data.get("timestamp"),
            "data": data,
        })
    return rows


def list_rows(db) -> list[dict]:
    """All log rows, newest first.

    Merges the Supabase ``ai_logs`` table with local files, deduped by filename
    (DB wins). This keeps logs visible in every situation:
      - DB only (e.g. Render, where the local disk is wiped on restart)
      - files only (local dev, or before the ai_logs table/migration exists)
      - both (save() mirrors to each with the same filename → no double count)

    The previous version returned the DB result even when it was empty, which
    hid local file logs whenever the ai_logs table was empty or missing.
    """
    by_name: dict[str, dict] = {}
    # Local files first (lower priority).
    for row in _file_rows():
        fn = row.get("filename")
        if fn:
            by_name[fn] = row
    # DB rows override (authoritative when present).
    if db is not None:
        try:
            res = (
                db.table(_TABLE)
                .select("*")
                .order("filename", desc=True)
                .limit(5000)
                .execute()
            )
            for row in (res.data or []):
                fn = row.get("filename")
                if fn:
                    by_name[fn] = row
        except Exception as e:
            logger.warning("ai_logs DB list failed (%s); using files only", e)
    # filename is timestamp-prefixed, so a reverse lexical sort = newest first.
    return sorted(by_name.values(), key=lambda r: r.get("filename") or "", reverse=True)


def get(db, filename: str) -> dict | None:
    """Full log ``data`` dict for one filename (DB first, then file)."""
    if db is not None:
        try:
            res = db.table(_TABLE).select("data").eq("filename", filename).limit(1).execute()
            if res.data:
                return res.data[0]["data"]
        except Exception as e:
            logger.warning("ai_logs DB get failed (%s); trying file", e)
    p = LOG_DIR / filename
    if p.exists():
        try:
            with open(p, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None
    return None


def parse_meta(data: dict, filename: str) -> dict:
    """Extract light metadata from a log ``data`` dict (for the list view)."""
    try:
        skill_calls = data.get("skill_calls", [])
        llm_calls = data.get("llm_calls", [])
        # Rough token estimate: 4 chars ≈ 1 token for each message text.
        token_est = sum(
            len(str(m.get("content", "")))
            for call in llm_calls
            for m in call.get("messages", [])
        ) // 4
        llm_errors = data.get("llm_errors", [])
        last_error = llm_errors[-1] if llm_errors else None
        return {
            "filename": filename,
            "timestamp": data.get("timestamp"),
            "user_id": data.get("user_id"),
            "user_input": (data.get("user_input") or "")[:100],
            "llm_call_count": len(llm_calls),
            "skill_call_count": len(skill_calls),
            "skill_names": [s.get("name") for s in skill_calls],
            "token_estimate": token_est,
            "error_count": len(llm_errors),
            "error_kind": (last_error or {}).get("kind") if last_error else None,
            "last_error": (last_error or {}).get("error") if last_error else None,
        }
    except Exception:
        return {"filename": filename, "error": "parse error"}


# ── Delete ────────────────────────────────────────────────────────────────────

def delete_for_user(db, user_id: str) -> int:
    """Delete one user's logs (DB rows + any local file mirrors)."""
    n = 0
    if db is not None:
        try:
            res = db.table(_TABLE).delete().eq("user_id", user_id).execute()
            n += len(res.data or [])
        except Exception as e:
            logger.warning("ai_logs DB delete (user) failed: %s", e)
    uid8 = user_id[:8]
    if LOG_DIR.exists():
        for p in LOG_DIR.glob("*.json"):
            if uid8 in p.stem:
                try:
                    p.unlink()
                    n += 1
                except Exception:
                    pass
    return n


def delete_all(db) -> int:
    """Delete every log (DB rows + all local files)."""
    n = 0
    if db is not None:
        try:
            res = db.table(_TABLE).delete().neq("filename", "").execute()
            n += len(res.data or [])
        except Exception as e:
            logger.warning("ai_logs DB delete (all) failed: %s", e)
    if LOG_DIR.exists():
        for p in LOG_DIR.glob("*.json"):
            try:
                p.unlink()
                n += 1
            except Exception:
                pass
    return n
