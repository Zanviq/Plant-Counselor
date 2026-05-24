from __future__ import annotations
from datetime import datetime, date

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Bud(Base):
    __tablename__ = "buds"

    __table_args__ = (
        Index("ix_buds_user_status", "user_id", "status"),
        Index("ix_buds_user_deadline", "user_id", "deadline"),
        Index("ix_buds_plant_status", "plant_id", "status"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    plant_id: Mapped[str] = mapped_column(
        String, ForeignKey("plants.id", ondelete="CASCADE"), nullable=False
    )

    title: Mapped[str] = mapped_column(String, nullable=False)
    detail: Mapped[str] = mapped_column(String, nullable=False, default="")

    # concern / schedule
    type: Mapped[str] = mapped_column(String, nullable=False, default="concern")

    # seed / bud / flower / fruit / harvested / wilting / rot
    status: Mapped[str] = mapped_column(String, nullable=False, default="seed")

    progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_progress_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    disappeared_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

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


class BudHistory(Base):
    __tablename__ = "bud_histories"

    __table_args__ = (Index("ix_bud_histories_bud_at", "bud_id", "at"),)

    id: Mapped[str] = mapped_column(String, primary_key=True)
    bud_id: Mapped[str] = mapped_column(
        String, ForeignKey("buds.id", ondelete="CASCADE"), nullable=False
    )
    from_status: Mapped[str] = mapped_column(String, nullable=False)
    to_status: Mapped[str] = mapped_column(String, nullable=False)
    at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    reason: Mapped[str] = mapped_column(String, nullable=False, default="")

