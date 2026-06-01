from __future__ import annotations
import logging
from datetime import datetime

from app.ai import log_store

logger = logging.getLogger(__name__)


class LogRecorder:
    """채팅 한 턴의 전체 컨텍스트를 저장 (Supabase ai_logs 테이블 + 로컬 파일 미러).

    저장은 log_store가 담당한다: DB가 가능하면 DB가 정본, 아니면 파일로 폴백.
    Render 무료처럼 디스크가 휘발성인 환경에서도 로그가 살아남게 하기 위함.
    """

    def __init__(self, user_id: str, text: str):
        now = datetime.now()
        self._filename = f"{now.strftime('%Y%m%d_%H%M%S_%f')[:22]}_{user_id[:8]}.json"
        self._user_id = user_id
        self._created_at = now.isoformat()
        self._data: dict = {
            "timestamp": self._created_at,
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

    def save(self, db=None) -> None:
        """Persist the turn. Pass the Supabase client so the log survives restarts."""
        try:
            log_store.save(db, self._filename, self._user_id, self._created_at, self._data)
            logger.info("Chat log saved: %s", self._filename)
        except Exception as e:
            logger.error("Chat log save failed: %s", e)
