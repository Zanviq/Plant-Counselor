"""Public, unauthenticated app metadata endpoints."""
from __future__ import annotations

from fastapi import APIRouter

import app.runtime_settings as rs

router = APIRouter(tags=["public"])


def _format_model_name(model_id: str) -> str:
    parts = model_id.split("-")
    if not parts:
        return model_id
    return " ".join(part.capitalize() if not part.replace(".", "").isdigit() else part for part in parts)


@router.get("/public/runtime")
def get_public_runtime():
    """Expose only display-safe runtime settings for public pages."""
    model = str(rs.get("llm_default_model", rs.DEFAULTS["llm_default_model"]))
    return {
        "ok": True,
        "data": {
            "llm_default_model": model,
            "llm_default_model_label": _format_model_name(model),
        },
    }
