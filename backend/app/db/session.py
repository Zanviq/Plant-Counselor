"""SQLAlchemy engine and session factory for Supabase PostgreSQL."""
from __future__ import annotations
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,   # verify connections before use (handles idle timeouts)
    pool_size=5,          # persistent connections for FastAPI workers
    max_overflow=10,      # burst headroom
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
