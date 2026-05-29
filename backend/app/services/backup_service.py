"""BackupService — full data export/import for the admin data page.

A backup is a single ZIP archive containing two JSON entries:
  - meta.json : lightweight {version, created_at, counts} for fast listing
  - data.json : {table_name: [row, ...]} full dump of every table

Restore is *non-destructive*: rows whose primary key (id) already exists in
the target DB are skipped, never overwritten. Tables are restored in
foreign-key dependency order so child rows land after their parents.
"""
from __future__ import annotations

import io
import json
import logging
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any

from supabase import Client

logger = logging.getLogger(__name__)

BACKUP_DIR = Path(__file__).parent.parent.parent / "backups"

# Tables in FK dependency order: parents first so children can reference them.
#   profiles            → (auth.users)
#   plants              → profiles
#   buds                → plants, profiles
#   bud_history         → buds
#   garden_state        → profiles
#   conversations       → profiles
#   conversation_messages → conversations
#   notifications       → profiles
_TABLES: list[str] = [
    "profiles",
    "plants",
    "buds",
    "bud_history",
    "garden_state",
    "conversations",
    "conversation_messages",
    "notifications",
]

_BACKUP_VERSION = 1
_INSERT_CHUNK = 500


def _safe_name(filename: str) -> str:
    """Reject path traversal; only allow plain backup_*.zip names."""
    if "/" in filename or "\\" in filename or ".." in filename or not filename.endswith(".zip"):
        raise ValueError("유효하지 않은 백업 파일명입니다.")
    return filename


class BackupService:
    def __init__(self, db: Client) -> None:
        self.db = db

    # ── Create ──────────────────────────────────────────────────────────────

    def create_backup(self) -> dict:
        """Dump every table to a timestamped ZIP and return its metadata."""
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)

        data: dict[str, list[dict]] = {}
        counts: dict[str, int] = {}
        for table in _TABLES:
            try:
                rows = self._dump_table(table)
            except Exception as e:
                logger.warning("Backup: could not dump table %s: %s", table, e)
                rows = []
            data[table] = rows
            counts[table] = len(rows)

        created_at = datetime.utcnow().isoformat()
        meta = {"version": _BACKUP_VERSION, "created_at": created_at, "counts": counts}

        # Filename uses real UTC time (an external artifact, not affected by time travel).
        stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"backup_{stamp}.zip"
        path = BACKUP_DIR / filename

        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
            zf.writestr("meta.json", json.dumps(meta, ensure_ascii=False, default=str))
            zf.writestr("data.json", json.dumps({"tables": data}, ensure_ascii=False, default=str))

        size = path.stat().st_size
        logger.info("Backup created: %s (%d bytes, counts=%s)", filename, size, counts)
        return {"filename": filename, "size_bytes": size, "created_at": created_at, "counts": counts}

    def _dump_table(self, table: str) -> list[dict]:
        """Fetch all rows from a table, paging to bypass PostgREST row limits."""
        rows: list[dict] = []
        page = 0
        page_size = 1000
        while True:
            start = page * page_size
            end = start + page_size - 1
            res = self.db.table(table).select("*").range(start, end).execute()
            batch = res.data or []
            rows.extend(batch)
            if len(batch) < page_size:
                break
            page += 1
        return rows

    # ── List / inspect ──────────────────────────────────────────────────────

    def list_backups(self) -> list[dict]:
        """Return metadata for every backup, newest first (reads only meta.json)."""
        if not BACKUP_DIR.exists():
            return []
        items: list[dict] = []
        for path in sorted(BACKUP_DIR.glob("backup_*.zip"), reverse=True):
            entry: dict[str, Any] = {
                "filename": path.name,
                "size_bytes": path.stat().st_size,
            }
            try:
                with zipfile.ZipFile(path) as zf:
                    meta = json.loads(zf.read("meta.json"))
                entry["created_at"] = meta.get("created_at")
                entry["counts"] = meta.get("counts", {})
                entry["total_rows"] = sum(meta.get("counts", {}).values())
            except Exception:
                entry["error"] = "메타데이터를 읽을 수 없습니다."
            items.append(entry)
        return items

    def backup_path(self, filename: str) -> Path:
        path = BACKUP_DIR / _safe_name(filename)
        if not path.exists():
            raise FileNotFoundError("백업 파일을 찾을 수 없습니다.")
        return path

    # ── Restore ─────────────────────────────────────────────────────────────

    def restore_backup(self, filename: str) -> dict:
        """Restore a backup without overwriting existing rows.

        For each table, rows whose `id` already exists in the DB are skipped.
        Only new rows are inserted, in FK dependency order.
        """
        path = self.backup_path(filename)
        with zipfile.ZipFile(path) as zf:
            payload = json.loads(zf.read("data.json"))
        tables: dict[str, list[dict]] = payload.get("tables", {})

        result: dict[str, dict] = {}
        for table in _TABLES:  # FK order
            rows = tables.get(table, [])
            result[table] = self._restore_table(table, rows)

        logger.info("Backup restored: %s — %s", filename, result)
        return {"filename": filename, "tables": result}

    def _restore_table(self, table: str, rows: list[dict]) -> dict:
        summary = {"total": len(rows), "inserted": 0, "skipped": 0, "failed": 0}
        if not rows:
            return summary

        # Existing primary keys → skip (never overwrite).
        existing: set = set()
        try:
            res = self.db.table(table).select("id").execute()
            existing = {r["id"] for r in (res.data or []) if "id" in r}
        except Exception as e:
            logger.warning("Restore: could not read existing ids for %s: %s", table, e)

        new_rows = [r for r in rows if r.get("id") not in existing]
        summary["skipped"] = len(rows) - len(new_rows)

        for i in range(0, len(new_rows), _INSERT_CHUNK):
            chunk = new_rows[i : i + _INSERT_CHUNK]
            try:
                self.db.table(table).insert(chunk).execute()
                summary["inserted"] += len(chunk)
            except Exception as e:
                # A chunk can fail on FK/constraint issues (e.g. profile whose
                # auth user is absent in this environment). Fall back to
                # per-row inserts so one bad row doesn't drop the whole chunk.
                logger.warning("Restore: chunk insert failed for %s, retrying row-by-row: %s", table, e)
                for row in chunk:
                    try:
                        self.db.table(table).insert(row).execute()
                        summary["inserted"] += 1
                    except Exception:
                        summary["failed"] += 1
        return summary

    # ── Delete ──────────────────────────────────────────────────────────────

    def delete_backup(self, filename: str) -> bool:
        path = self.backup_path(filename)
        path.unlink()
        logger.info("Backup deleted: %s", filename)
        return True
