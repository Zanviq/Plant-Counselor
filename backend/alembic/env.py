"""Alembic environment.

Migrations are plain SQL (op.execute); there is no ORM metadata. The URL comes
from app.config.settings.database_url and is rewritten to the SQLAlchemy
psycopg 3 dialect.
"""
from __future__ import annotations

from alembic import context
from sqlalchemy import create_engine, pool

from app.config import settings

config = context.config


def _sqlalchemy_url() -> str:
    url = settings.database_url
    for prefix in ("postgresql://", "postgres://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


def run_migrations_offline() -> None:
    context.configure(url=_sqlalchemy_url(), literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(_sqlalchemy_url(), poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
