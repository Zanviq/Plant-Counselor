"""Per-session edit/delete permissions for AI skills.

Authority model (by chat scope):
  - global   : full rights over everything.
  - plant/X  : may modify/delete only buds belonging to plant X, and delete plant X.
  - bud/X    : may modify/delete only bud X.
  - calendar : full rights over standalone calendar events; for plant buds it may
               only create/read, NOT modify/delete.

Creation & reading are broadly allowed in every scope; these guards only gate
mutation (update/delete/status/progress/deadline) of existing items.
"""
from __future__ import annotations

from typing import Any

_ALLOW: tuple[bool, str] = (True, "")


def _deny(msg: str) -> tuple[bool, str]:
    return (False, msg)


def can_modify_bud(ctx: Any, bud: Any) -> tuple[bool, str]:
    scope = getattr(ctx, "scope", "global")
    sid = getattr(ctx, "scope_id", None)
    if scope == "global":
        return _ALLOW
    if scope == "bud":
        if getattr(bud, "id", None) == sid:
            return _ALLOW
        return _deny("이 봉우리 세션에서는 다른 봉우리를 수정·삭제할 수 없어요. "
                     "해당 봉우리 세션이나 전체 세션에서 다시 시도해 주세요.")
    if scope == "plant":
        if getattr(bud, "plant_id", None) == sid:
            return _ALLOW
        return _deny("이 식물 세션에서는 다른 식물의 봉우리를 수정·삭제할 수 없어요. "
                     "해당 식물 세션으로 옮기거나 전체 세션에서 시도해 주세요.")
    if scope == "calendar":
        return _deny("캘린더 세션에서는 식물 일정(봉우리)을 수정·삭제할 수 없어요. "
                     "생성·조회만 가능합니다. 수정·삭제는 해당 식물 세션이나 전체 세션에서 해주세요.")
    return _ALLOW


def can_delete_plant(ctx: Any, plant_id: str) -> tuple[bool, str]:
    scope = getattr(ctx, "scope", "global")
    sid = getattr(ctx, "scope_id", None)
    if scope == "global":
        return _ALLOW
    if scope == "plant" and plant_id == sid:
        return _ALLOW
    if scope == "plant":
        return _deny("이 식물 세션에서는 다른 식물을 삭제할 수 없어요. "
                     "해당 식물 세션이나 전체 세션에서 해주세요.")
    return _deny("식물 삭제는 해당 식물 세션이나 전체 세션에서만 가능해요.")


def can_modify_calendar_event(ctx: Any) -> tuple[bool, str]:
    scope = getattr(ctx, "scope", "global")
    if scope in ("global", "calendar"):
        return _ALLOW
    return _deny("일반 일정의 수정·삭제는 캘린더 세션이나 전체 세션에서 해주세요.")


def guard_bud(ctx: Any, bud_id: str):
    """Fetch the bud and verify modify permission for the current session.

    Returns (bud, None) when allowed, or (None, SkillResult-error) when the bud
    is missing or the current session lacks authority.
    """
    from app.ai.skill_base import SkillResult

    try:
        bud = ctx.bud_service.get(ctx.user_id, bud_id)
    except Exception:
        bud = None
    if bud is None:
        return None, SkillResult(ok=False, message="봉우리를 찾을 수 없습니다.", error_code="not_found")

    ok, msg = can_modify_bud(ctx, bud)
    if not ok:
        return None, SkillResult(ok=False, message=msg, error_code="forbidden",
                                 data={"forbidden": True})
    return bud, None
