"""Supabase PostgREST client — replaces SQLAlchemy Session.

All DB access goes through the Supabase REST API over HTTPS, avoiding the
psycopg2 direct-connection issues (pooler ENOTFOUND, IPv6-only direct host).

Usage (same as before in routes):
    db: DB = Depends(get_db)
"""
from __future__ import annotations

from functools import lru_cache
from typing import Any

from supabase import Client, create_client

from app.config import settings


@lru_cache(maxsize=1)
def _make_client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_client() -> Client:
    return _make_client()


# Type alias used in function signatures so `DB` is recognisable.
DB = Client
