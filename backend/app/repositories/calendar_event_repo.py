"""CalendarEventRepository — standalone calendar events (not buds).

Backed by the `exec_admin_query` RPC instead of PostgREST (`db.table`) because a
freshly-created table is not auto-exposed by Supabase's PostgREST schema cache.
See migrations/001_calendar_events.sql.

SQL injection safety: every value is rendered through `_lit()`, which quotes the
value as a SQL string literal and doubles embedded single quotes. Supabase runs
with standard_conforming_strings = on, so the single quote is the only literal
metacharacter — doubling it is sufficient. Column/table names are hardcoded.
"""
from __future__ import annotations

from datetime import date
from types import SimpleNamespace
from typing import Any

from supabase import Client
from ulid import ULID


def _row(d: dict | None) -> SimpleNamespace | None:
    return SimpleNamespace(**d) if d else None


def _rows(lst: list[dict]) -> list[SimpleNamespace]:
    return [SimpleNamespace(**d) for d in lst]


def _lit(v: Any) -> str:
    """Render a value as a safe SQL string literal (or NULL).

    Doubles single quotes — the only literal metacharacter under
    standard_conforming_strings = on (Supabase default). Backslashes are
    literal in that mode and must NOT be doubled, or backslash-containing
    text would be corrupted on round-trip.
    """
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


_COLS = "id, user_id, plant_id, title, detail, event_date, color"


class CalendarEventRepository:
    def __init__(self, db: Client) -> None:
        self.db = db

    # ── low-level RPC helpers ────────────────────────────────────────────────

    def _exec(self, sql: str) -> dict | list | None:
        res = self.db.rpc("exec_admin_query", {"sql_query": sql}).execute()
        data = res.data
        if isinstance(data, dict) and data.get("error"):
            raise RuntimeError(f"calendar_events SQL error: {data['error']}")
        return data

    def _select(self, sql: str) -> list[dict]:
        data = self._exec(sql)
        if isinstance(data, dict):
            return data.get("rows", []) or []
        return []

    # ── CRUD ─────────────────────────────────────────────────────────────────

    def create(
        self,
        user_id: str,
        plant_id: str | None,
        title: str,
        detail: str,
        event_date: date,
        color: str,
    ) -> SimpleNamespace:
        eid = str(ULID())
        vals = ", ".join([
            _lit(eid), _lit(user_id), _lit(plant_id),
            _lit(title), _lit(detail or ""), _lit(event_date.isoformat()), _lit(color),
        ])
        self._exec(f"insert into calendar_events ({_COLS}) values ({vals})")
        return SimpleNamespace(
            id=eid, user_id=user_id, plant_id=plant_id,
            title=title, detail=detail or "", event_date=event_date.isoformat(), color=color,
        )

    def list_range(self, user_id: str, d_from: date, d_to: date) -> list[SimpleNamespace]:
        sql = (
            f"select {_COLS} from calendar_events "
            f"where user_id = {_lit(user_id)} "
            f"and event_date >= {_lit(d_from.isoformat())} "
            f"and event_date <= {_lit(d_to.isoformat())} "
            f"order by event_date"
        )
        return _rows(self._select(sql))

    def get(self, user_id: str, event_id: str) -> SimpleNamespace | None:
        sql = (
            f"select {_COLS} from calendar_events "
            f"where id = {_lit(event_id)} and user_id = {_lit(user_id)} limit 1"
        )
        rows = self._select(sql)
        return _row(rows[0]) if rows else None

    def update(self, user_id: str, event_id: str, fields: dict) -> SimpleNamespace | None:
        sets: list[str] = []
        for key in ("title", "detail", "plant_id", "event_date", "color"):
            if key in fields and (fields[key] is not None or key == "plant_id"):
                val = fields[key]
                if key == "event_date" and isinstance(val, date):
                    val = val.isoformat()
                sets.append(f"{key} = {_lit(val)}")
        if not sets:
            return self.get(user_id, event_id)
        sets.append("updated_at = now()")
        sql = (
            f"update calendar_events set {', '.join(sets)} "
            f"where id = {_lit(event_id)} and user_id = {_lit(user_id)}"
        )
        self._exec(sql)
        return self.get(user_id, event_id)

    def delete(self, user_id: str, event_id: str) -> bool:
        # Confirm ownership/existence first so the caller can 404 correctly.
        if self.get(user_id, event_id) is None:
            return False
        self._exec(
            f"delete from calendar_events "
            f"where id = {_lit(event_id)} and user_id = {_lit(user_id)}"
        )
        return True
