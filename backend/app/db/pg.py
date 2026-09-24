"""PostgreSQL access layer (psycopg 3 + connection pool).

The backend was originally written against a hosted REST database API with a fluent
query builder (``db.table("buds").select("*").eq("user_id", uid).execute()``).
This module keeps that same small interface so repositories and services stay
unchanged, but compiles each chain into a parameterised SQL statement and runs
it against a local PostgreSQL server.

Supported builder surface (only what the codebase uses):
    table(name)
      .select(cols="*", count=None) / .insert(row|rows) / .update(fields)
      .upsert(row|rows, on_conflict=None, ignore_duplicates=False) / .delete()
      .eq .neq .gt .gte .lt .lte .like .ilike .in_ .is_(col, "null") .contains
      .not_ (negates the next filter)
      .order(col, desc=False, nullsfirst=None) .limit(n) .range(start, end)
      .execute() -> Result(data=list[dict], count=int|None)
    rpc("exec_admin_query", {"sql_query": sql}).execute()

Rows are returned as JSON-compatible dicts (dates/times as ISO strings,
numerics as int/float), matching the shape the code was written against.

Values are always sent as bind parameters. Table/column identifiers come from
application code only and are additionally validated against a strict pattern
and quoted with ``psycopg.sql.Identifier``.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date, datetime, time
from decimal import Decimal
from functools import lru_cache
from typing import Any

from psycopg import sql
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from app.config import settings

logger = logging.getLogger(__name__)

_IDENT = re.compile(r"^[a-z_][a-z0-9_]*$")


def _ident(name: str) -> sql.Identifier:
    if not _IDENT.match(name):
        raise ValueError(f"Invalid SQL identifier: {name!r}")
    return sql.Identifier(name)


def _jsonable(v: Any) -> Any:
    """Convert a DB value to the JSON-compatible shape callers expect."""
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, (date, time)):
        return v.isoformat()
    if isinstance(v, Decimal):
        return int(v) if v == v.to_integral_value() else float(v)
    if isinstance(v, dict):
        return {k: _jsonable(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_jsonable(x) for x in v]
    return v


def _row_out(row: dict) -> dict:
    return {k: _jsonable(v) for k, v in row.items()}


def _param(v: Any) -> Any:
    """Wrap dict/list values so they bind as jsonb."""
    if isinstance(v, (dict, list)):
        return Jsonb(v)
    return v


@lru_cache(maxsize=1)
def _pool() -> ConnectionPool:
    pool = ConnectionPool(
        conninfo=settings.database_url,
        min_size=1,
        max_size=settings.database_pool_size,
        kwargs={"autocommit": True, "row_factory": dict_row, "options": "-c timezone=UTC"},
        open=True,
    )
    return pool


@dataclass
class Result:
    data: Any
    count: int | None = None


class _Filter:
    __slots__ = ("col", "op", "value", "negate")

    def __init__(self, col: str, op: str, value: Any, negate: bool) -> None:
        self.col, self.op, self.value, self.negate = col, op, value, negate

    def compile(self) -> tuple[sql.Composable, list[Any]]:
        col = _ident(self.col)
        if self.op == "is":
            if str(self.value).lower() != "null":
                raise ValueError("is_() only supports 'null'")
            clause = sql.SQL("{} IS NULL").format(col)
            params: list[Any] = []
        elif self.op == "in":
            values = list(self.value)
            clause = sql.SQL("{} = ANY(%s)").format(col)
            params = [values]
        elif self.op == "contains":
            clause = sql.SQL("{} @> %s").format(col)
            params = [Jsonb(self.value)]
        else:
            ops = {"eq": "=", "neq": "<>", "gt": ">", "gte": ">=", "lt": "<", "lte": "<=",
                   "like": "LIKE", "ilike": "ILIKE"}
            clause = sql.SQL("{} " + ops[self.op] + " %s").format(col)
            params = [self.value]
        if self.negate:
            clause = sql.SQL("NOT ({})").format(clause)
        return clause, params


class _Not:
    """Proxy returned by ``.not_`` — negates the next filter call."""

    def __init__(self, q: "Query") -> None:
        self._q = q

    def __getattr__(self, name: str):
        method = getattr(self._q, name)

        def wrapper(*args, **kwargs):
            self._q._negate_next = True
            return method(*args, **kwargs)

        return wrapper


class Query:
    def __init__(self, db: "Client", table: str) -> None:
        self._db = db
        self._table = table
        self._action = "select"
        self._columns = "*"
        self._count: str | None = None
        self._payload: Any = None
        self._filters: list[_Filter] = []
        self._orders: list[tuple[str, bool, bool | None]] = []
        self._limit: int | None = None
        self._offset: int | None = None
        self._negate_next = False

    # ── actions ────────────────────────────────────────────────────────────
    def select(self, columns: str = "*", *more: str, count: str | None = None) -> "Query":
        self._action = "select"
        self._columns = ",".join((columns, *more)) if more else columns
        self._count = count
        return self

    def insert(self, rows: dict | list[dict]) -> "Query":
        self._action, self._payload = "insert", rows
        return self

    def upsert(self, rows: dict | list[dict], on_conflict: str | None = None,
               ignore_duplicates: bool = False) -> "Query":
        self._action, self._payload = "upsert", rows
        self._on_conflict = on_conflict
        self._ignore_duplicates = ignore_duplicates
        return self

    def update(self, fields: dict) -> "Query":
        self._action, self._payload = "update", fields
        return self

    def delete(self) -> "Query":
        self._action = "delete"
        return self

    # ── filters ────────────────────────────────────────────────────────────
    def _add(self, col: str, op: str, value: Any) -> "Query":
        self._filters.append(_Filter(col, op, value, self._negate_next))
        self._negate_next = False
        return self

    @property
    def not_(self) -> _Not:
        return _Not(self)

    def eq(self, col: str, v: Any) -> "Query": return self._add(col, "eq", v)
    def neq(self, col: str, v: Any) -> "Query": return self._add(col, "neq", v)
    def gt(self, col: str, v: Any) -> "Query": return self._add(col, "gt", v)
    def gte(self, col: str, v: Any) -> "Query": return self._add(col, "gte", v)
    def lt(self, col: str, v: Any) -> "Query": return self._add(col, "lt", v)
    def lte(self, col: str, v: Any) -> "Query": return self._add(col, "lte", v)
    def like(self, col: str, v: str) -> "Query": return self._add(col, "like", v)
    def ilike(self, col: str, v: str) -> "Query": return self._add(col, "ilike", v)
    def in_(self, col: str, values) -> "Query": return self._add(col, "in", values)
    def is_(self, col: str, v: Any) -> "Query": return self._add(col, "is", v)
    def contains(self, col: str, v: Any) -> "Query": return self._add(col, "contains", v)

    # ── modifiers ──────────────────────────────────────────────────────────
    def order(self, col: str, desc: bool = False, nullsfirst: bool | None = None) -> "Query":
        self._orders.append((col, desc, nullsfirst))
        return self

    def limit(self, n: int) -> "Query":
        self._limit = int(n)
        return self

    def range(self, start: int, end: int) -> "Query":
        self._offset = int(start)
        self._limit = int(end) - int(start) + 1
        return self

    # ── compile helpers ────────────────────────────────────────────────────
    def _where(self) -> tuple[sql.Composable, list[Any]]:
        if not self._filters:
            return sql.SQL(""), []
        parts, params = [], []
        for f in self._filters:
            clause, p = f.compile()
            parts.append(clause)
            params.extend(p)
        return sql.SQL(" WHERE ") + sql.SQL(" AND ").join(parts), params

    def _select_list(self) -> sql.Composable:
        cols = [c.strip() for c in self._columns.split(",") if c.strip()]
        if not cols or cols == ["*"]:
            return sql.SQL("*")
        return sql.SQL(", ").join(_ident(c) for c in cols)

    def _order_limit(self) -> sql.Composable:
        out = sql.SQL("")
        if self._orders:
            items = []
            for col, desc, nullsfirst in self._orders:
                s = sql.SQL("{} " + ("DESC" if desc else "ASC")).format(_ident(col))
                if nullsfirst is not None:
                    s = s + sql.SQL(" NULLS FIRST" if nullsfirst else " NULLS LAST")
                items.append(s)
            out = out + sql.SQL(" ORDER BY ") + sql.SQL(", ").join(items)
        if self._limit is not None:
            out = out + sql.SQL(" LIMIT {}").format(sql.Literal(self._limit))
        if self._offset is not None:
            out = out + sql.SQL(" OFFSET {}").format(sql.Literal(self._offset))
        return out

    def _primary_key(self) -> list[str]:
        return self._db.primary_key(self._table)

    # ── execute ────────────────────────────────────────────────────────────
    def execute(self) -> Result:
        table = _ident(self._table)
        where, wparams = self._where()

        if self._action == "select":
            stmt = sql.SQL("SELECT {} FROM {}").format(self._select_list(), table) + where + self._order_limit()
            rows = self._db._fetch(stmt, wparams)
            count = None
            if self._count:
                cstmt = sql.SQL("SELECT count(*) AS n FROM {}").format(table) + where
                count = self._db._fetch(cstmt, wparams)[0]["n"]
            return Result(rows, count)

        if self._action in ("insert", "upsert"):
            rows = self._payload if isinstance(self._payload, list) else [self._payload]
            if not rows:
                return Result([])
            cols = list(rows[0].keys())
            for r in rows[1:]:
                for k in r.keys():
                    if k not in cols:
                        cols.append(k)
            values_sql = sql.SQL(", ").join(
                sql.SQL("(") + sql.SQL(", ").join(
                    (sql.Placeholder() if c in r else sql.SQL("DEFAULT")) for c in cols
                ) + sql.SQL(")")
                for r in rows
            )
            params = [_param(r[c]) for r in rows for c in cols if c in r]
            stmt = sql.SQL("INSERT INTO {} ({}) VALUES ").format(
                table, sql.SQL(", ").join(_ident(c) for c in cols)
            ) + values_sql
            if self._action == "upsert":
                conflict = [c.strip() for c in (getattr(self, "_on_conflict", None) or "").split(",") if c.strip()]
                conflict = conflict or self._primary_key()
                updates = [c for c in cols if c not in conflict]
                stmt = stmt + sql.SQL(" ON CONFLICT ({}) ").format(
                    sql.SQL(", ").join(_ident(c) for c in conflict)
                )
                if updates and not getattr(self, "_ignore_duplicates", False):
                    stmt = stmt + sql.SQL("DO UPDATE SET ") + sql.SQL(", ").join(
                        sql.SQL("{} = EXCLUDED.{}").format(_ident(c), _ident(c)) for c in updates
                    )
                else:
                    stmt = stmt + sql.SQL("DO NOTHING")
            stmt = stmt + sql.SQL(" RETURNING *")
            return Result(self._db._fetch(stmt, params))

        if self._action == "update":
            fields = self._payload or {}
            if not fields:
                return Result([])
            sets = sql.SQL(", ").join(sql.SQL("{} = %s").format(_ident(k)) for k in fields)
            params = [_param(v) for v in fields.values()]
            stmt = sql.SQL("UPDATE {} SET ").format(table) + sets + where + sql.SQL(" RETURNING *")
            return Result(self._db._fetch(stmt, params + wparams))

        if self._action == "delete":
            stmt = sql.SQL("DELETE FROM {}").format(table) + where + sql.SQL(" RETURNING *")
            return Result(self._db._fetch(stmt, wparams))

        raise ValueError(f"Unsupported action: {self._action}")


class _Rpc:
    def __init__(self, db: "Client", name: str, params: dict) -> None:
        self._db, self._name, self._params = db, name, params

    def execute(self) -> Result:
        if self._name != "exec_admin_query":
            raise ValueError(f"Unknown RPC: {self._name}")
        return Result(self._db.exec_admin_query(str(self._params.get("sql_query", ""))))


class Client:
    """Drop-in replacement for the former hosted-DB client object."""

    def table(self, name: str) -> Query:
        return Query(self, name)

    def rpc(self, name: str, params: dict) -> _Rpc:
        return _Rpc(self, name, params)

    # ── low level ──────────────────────────────────────────────────────────
    def _fetch(self, stmt: sql.Composable, params: list[Any]) -> list[dict]:
        with _pool().connection() as conn:
            cur = conn.execute(stmt, params)
            if cur.description is None:
                return []
            return [_row_out(r) for r in cur.fetchall()]

    @lru_cache(maxsize=64)
    def primary_key(self, table: str) -> list[str]:
        rows = self._fetch(
            sql.SQL(
                "SELECT a.attname AS col FROM pg_index i "
                "JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) "
                "WHERE i.indrelid = %s::regclass AND i.indisprimary"
            ),
            [table],
        )
        return [r["col"] for r in rows] or ["id"]

    def exec_admin_query(self, query: str) -> dict:
        """Run raw SQL in a single transaction.

        Returns ``{"type": "select", "rows": [...]}`` when the last statement
        produced rows, otherwise ``{"type": "command", "affected": n, "rows": []}``.
        Errors are returned as ``{"error": message, "detail": sqlstate}`` instead
        of raised, which is the contract the admin SQL console and the
        calendar_events repository were written against.

        Callers are responsible for escaping values (see calendar_event_repo._lit)
        and for restricting access (admin console is guarded by require_admin).
        """
        try:
            with _pool().connection() as conn:
                with conn.transaction():
                    cur = conn.execute(query)
                    if cur.description is not None:
                        rows = [_row_out(r) for r in cur.fetchall()]
                        return {"type": "select", "rows": rows}
                    return {"type": "command", "affected": max(cur.rowcount, 0), "rows": []}
        except Exception as e:  # noqa: BLE001 — surfaced to the caller as data
            return {"error": str(e).strip(), "detail": getattr(getattr(e, "diag", None), "sqlstate", None) or "sql_error"}


_client = Client()


def get_client() -> Client:
    return _client


DB = Client
