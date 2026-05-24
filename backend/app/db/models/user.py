from __future__ import annotations
from datetime import datetime

from sqlalchemy import Boolean, DateTime, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    nickname: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)

    # 프로필
    address: Mapped[str] = mapped_column(String, nullable=False, default="")
    tone: Mapped[str] = mapped_column(String, nullable=False, default="counselor")

    # API 키 (암호화 저장)
    encrypted_api_key: Mapped[str | None] = mapped_column(String, nullable=True)

    # 정원 규칙 (JSON)
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

    # 외관 설정 (JSON)
    appearance: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default=lambda: {"theme": "auto", "animation": "subtle"},
    )

    # 사운드 설정 (JSON)
    sound: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default=lambda: {"sfx": True, "bgm": False, "volume": 0.6},
    )

    # AI 설정
    ai_model: Mapped[str] = mapped_column(String, nullable=False, default="claude-opus-4-7")
    ai_proactive: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # 타임스탬프
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=func.now(),
    )

