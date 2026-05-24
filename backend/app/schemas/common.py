"""Shared envelope schemas for the {ok, data}/{ok, error} response shape."""
from __future__ import annotations
from typing import Any

from pydantic import BaseModel


class ApiSuccess(BaseModel):
    ok: bool = True
    data: Any


class ApiError(BaseModel):
    ok: bool = False
    error: dict[str, Any]
