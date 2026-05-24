from __future__ import annotations
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Plant(Base):
    __tablename__ = "plants"

    __table_args__ = (
        Index("ix_plants_user_status", "user_id", "status"),
        Index("ix_plants_user_last_activity", "user_id", "last_activity_at"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False, default="")
    species: Mapped[str] = mapped_column(String, nullable=False, default="tree_oak")
    color: Mapped[str] = mapped_column(String, nullable=False, default="brand.primary_leaf")

    # active / dormant / archived
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")

    # 통계 JSON
    stats: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default=lambda: {"harvested_count": 0, "rot_count": 0, "active_bud_count": 0},
    )

    last_activity_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

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

