from __future__ import annotations
import json
import logging
import os
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

LOG_DIR = Path(__file__).parent.parent.parent / "logs" / "chat"


class LogRecorder:
    """채팅 한 턴의 전체 컨텍스트를 JSON 파일로 저장."""

    def __init__(self, user_id: str, text: str):
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:22]
        self._path = LOG_DIR / f"{ts}_{user_id[:8]}.json"
        self._data: dict = {
            "timestamp": datetime.now().isoformat(),
            "user_id": user_id,
            "user_input": text,
            "system_prompt": "",
            "history": [],
            "llm_calls": [],
            "skill_calls": [],
            "final_response": "",
            "events": [],
            "llm_errors": [],
        }

    def set_system(self, prompt: str) -> None:
        self._data["system_prompt"] = prompt

    def set_history(self, history: list[dict]) -> None:
        self._data["history"] = history

    def log_llm_call(self, call_n: int, messages: list[dict], tools_count: int) -> None:
        self._data["llm_calls"].append({
            "call": call_n,
            "messages_count": len(messages),
            "tools_count": tools_count,
            "messages": messages,
        })

    def log_llm_result(self, call_n: int, text: str, tool_use: dict | None) -> None:
        for entry in self._data["llm_calls"]:
            if entry["call"] == call_n:
                entry["result_text"] = text
                entry["result_tool_use"] = tool_use
                break

    def log_skill(self, name: str, args: dict, ok: bool, message: str, data: dict) -> None:
        self._data["skill_calls"].append({
            "name": name,
            "args": args,
            "ok": ok,
            "message": message,
            "data": data,
        })

    def log_llm_error(self, call_n: int, error: str, kind: str = "", cause: str = "") -> None:
        """Record a raw LLM/API error (e.g. Gemini 503) for admin diagnostics."""
        self._data["llm_errors"].append({
            "call": call_n,
            "error": error,
            "kind": kind,
            "cause": cause,
            "time": datetime.now().isoformat(),
        })
        for entry in self._data["llm_calls"]:
            if entry["call"] == call_n:
                entry["error"] = error
                entry["error_kind"] = kind
                break

    def log_event(self, event_type: str, detail: str = "") -> None:
        self._data["events"].append({
            "time": datetime.now().isoformat(),
            "type": event_type,
            "detail": detail,
        })

    def set_final(self, response_text: str) -> None:
        self._data["final_response"] = response_text

    def save(self) -> None:
        try:
            with open(self._path, "w", encoding="utf-8") as f:
                json.dump(self._data, f, ensure_ascii=False, indent=2, default=str)
            logger.info("Chat log saved: %s", self._path.name)
        except Exception as e:
            logger.error("Chat log save failed: %s", e)
