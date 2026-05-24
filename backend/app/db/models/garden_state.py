from __future__ import annotations
from datetime import datetime, date

from sqlalchemy import Date, DateTime, ForeignKey, JSON, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class GardenState(Base):
    __tablename__ = "garden_states"

    __table_args__ = (UniqueConstraint("user_id", name="uq_garden_state_user_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # 집계 캐시 (JSON)
    summary_cache: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default=lambda: {
            "active_concerns": 0,
            "active_schedules": 0,
            "harvested_this_month": 0,
            "wilting_count": 0,
            "rot_count": 0,
            "total_plants": 0,
        },
    )

    # 일일 브리핑
    daily_briefing: Mapped[str | None] = mapped_column(String, nullable=True)
    daily_briefing_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # 마지막 열람 시각
    last_opened_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

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

