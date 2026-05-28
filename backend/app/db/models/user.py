from __future__ import annotations
from datetime import datetime

from sqlalchemy import DateTime, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    """User profile table.

    The primary key is the Supabase Auth UUID (stored as text).
    Password management is handled entirely by Supabase Auth (Google OAuth).
    """

    __tablename__ = "profiles"

    # Supabase Auth UUID (from auth.users.id)
    id: Mapped[str] = mapped_column(String, primary_key=True)

    # Identity (from Google OAuth via Supabase trigger)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    nickname: Mapped[str | None] = mapped_column(String, nullable=True)

    # Preferences
    tone: Mapped[str] = mapped_column(String, nullable=False, default="counselor")

    # API key (Fernet-encrypted Gemini key)
    encrypted_api_key: Mapped[str | None] = mapped_column(String, nullable=True)

    # Garden rules (JSON)
    garden_rules: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default=lambda: {
            "wilting_days": 7,
            "rot_disappear_days": 14,
            "deadline_warn_days": 3,
            "auto_transition": True,
        },
    )

    # Appearance settings (JSON)
    appearance: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default=lambda: {"theme": "auto", "animation": "subtle"},
    )

    # AI settings
    ai_model: Mapped[str] = mapped_column(String, nullable=False, default="gemini-2.5-flash")

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
