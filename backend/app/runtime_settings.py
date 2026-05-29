"""Runtime settings — in-memory overrides for hardcoded defaults.

These are NOT persisted across restarts by default, but can be
saved/loaded via JSON snapshot (admin controller page).
"""
from __future__ import annotations
import json
import logging
from datetime import datetime, date, timedelta
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_SNAPSHOT_PATH = Path(__file__).parent.parent / "runtime_settings.json"

# ── Defaults ─────────────────────────────────────────────────────────────────

DEFAULTS: dict[str, Any] = {
    # LLM
    "llm_default_model": "gemini-2.5-flash",
    "llm_max_steps": 10,
    "llm_temperature": None,       # None = use Gemini default

    # Scheduler
    "scheduler_interval_minutes": 10,

    # Transition defaults (apply when user has no custom garden_rules)
    "default_wilting_days": 7,
    "default_rot_disappear_days": 14,
    "default_deadline_warn_days": 3,
    "default_auto_transition": True,

    # System
    "system_log_level": "INFO",
    "system_max_log_files": 500,

    # Time travel (demo only) — offset in seconds added to all datetime checks
    "time_offset_seconds": 0,
}

# Available Gemini models (listed for UI)
AVAILABLE_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-1.0-pro",
]

# ── Live store ────────────────────────────────────────────────────────────────

_store: dict[str, Any] = dict(DEFAULTS)


def get(key: str, default: Any = None) -> Any:
    return _store.get(key, DEFAULTS.get(key, default))


def get_all() -> dict[str, Any]:
    return dict(_store)


def set(key: str, value: Any) -> None:  # noqa: A001
    if key not in DEFAULTS:
        raise KeyError(f"Unknown runtime setting: {key!r}")
    _store[key] = value
    logger.info("Runtime setting changed: %s = %r", key, value)


def set_many(updates: dict[str, Any]) -> list[str]:
    """Update multiple settings. Returns list of unknown keys that were skipped."""
    skipped = []
    for k, v in updates.items():
        if k not in DEFAULTS:
            skipped.append(k)
            continue
        _store[k] = v
    return skipped


def reset(key: str) -> None:
    _store[key] = DEFAULTS[key]


def reset_all() -> None:
    _store.clear()
    _store.update(DEFAULTS)


def save_snapshot() -> None:
    """Persist current settings to disk so they survive restarts."""
    try:
        with open(_SNAPSHOT_PATH, "w", encoding="utf-8") as f:
            json.dump(_store, f, ensure_ascii=False, indent=2, default=str)
        logger.info("Runtime settings snapshot saved.")
    except Exception as e:
        logger.warning("Could not save runtime settings: %s", e)


def load_snapshot() -> None:
    """Load persisted settings if snapshot exists."""
    if not _SNAPSHOT_PATH.exists():
        return
    try:
        with open(_SNAPSHOT_PATH, encoding="utf-8") as f:
            saved = json.load(f)
        for k, v in saved.items():
            if k in DEFAULTS:
                _store[k] = v
        logger.info("Runtime settings loaded from snapshot.")
    except Exception as e:
        logger.warning("Could not load runtime settings snapshot: %s", e)


# ── Time helpers ─────────────────────────────────────────────────────────────

def now() -> datetime:
    """Return the current UTC datetime, adjusted by the time offset."""
    offset = _store.get("time_offset_seconds", 0) or 0
    return datetime.utcnow() + timedelta(seconds=int(offset))


def today() -> date:
    """Return the current date, adjusted by the time offset."""
    return now().date()


def time_offset_seconds() -> int:
    return int(_store.get("time_offset_seconds", 0) or 0)


# Load snapshot on module import
load_snapshot()
