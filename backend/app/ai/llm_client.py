from __future__ import annotations
import json
import logging
import time

logger = logging.getLogger(__name__)

# Transient upstream conditions worth retrying (Gemini overload / rate spikes).
_RETRYABLE_MARKERS = ("503", "unavailable", "overloaded", "high demand",
                      "deadline", "timeout", "500", "internal error")
_MAX_RETRIES = 3            # total attempts = _MAX_RETRIES
_BACKOFF_BASE = 1.0         # seconds: 1s, 2s between attempts


class LLMClient:
    """Gemini API 기반 LLM 클라이언트."""

    DEFAULT_MODEL = "gemini-2.5-flash"

    def __init__(self, api_key: str, model: str = DEFAULT_MODEL):
        self._key = api_key
        self._model = model

    # ── 내부 변환 헬퍼 ──────────────────────────────────────

    def _to_gemini_messages(self, messages: list[dict]) -> list[dict]:
        """Anthropic 형식 메시지 → Gemini contents 형식으로 변환."""
        contents = []
        for msg in messages:
            role = "model" if msg["role"] == "assistant" else "user"
            content = msg.get("content", "")

            if isinstance(content, str):
                if content:
                    contents.append({"role": role, "parts": [{"text": content}]})
                continue

            # 리스트 형태 (tool_use / tool_result)
            parts = []
            for block in content:
                btype = block.get("type", "")
                if btype == "text":
                    parts.append({"text": block.get("text", "")})
                elif btype == "tool_use":
                    parts.append({
                        "function_call": {
                            "name": block["name"],
                            "args": block.get("input", {}),
                        }
                    })
                elif btype == "tool_result":
                    # tool_use_id 를 tool name 으로 사용
                    tool_name = block.get("tool_use_id", "unknown")
                    raw = block.get("content", "{}")
                    try:
                        result_data = json.loads(raw) if isinstance(raw, str) else raw
                    except Exception:
                        result_data = {"result": str(raw)}
                    parts.append({
                        "function_response": {
                            "name": tool_name,
                            "response": result_data,
                        }
                    })
            if parts:
                contents.append({"role": role, "parts": parts})
        return contents

    def _to_gemini_tools(self, tools: list[dict]) -> list[dict] | None:
        """Anthropic tool_spec → Gemini function_declarations 형식 변환."""
        if not tools:
            return None
        function_declarations = []
        for t in tools:
            schema = dict(t.get("input_schema", {}))
            # Gemini는 additionalProperties 등 일부 키를 허용하지 않음
            schema.pop("additionalProperties", None)
            function_declarations.append({
                "name": t["name"],
                "description": t.get("description", ""),
                "parameters": schema,
            })
        return [{"function_declarations": function_declarations}]

    # ── 공개 API ────────────────────────────────────────────

    def chat(self, messages: list[dict], tools: list[dict], system: str) -> dict:
        """
        Gemini API 호출.
        반환: {"text": str, "tool_use": dict | None}
        """
        if not self._key:
            return {
                "text": "API 키가 설정되지 않았습니다. 설정 > AI 설정에서 Gemini API 키를 입력해주세요.",
                "tool_use": None,
            }

        from google import genai
        from google.genai import types

        client = genai.Client(api_key=self._key)
        contents = self._to_gemini_messages(messages)
        gemini_tools = self._to_gemini_tools(tools)

        config_kwargs: dict = {"system_instruction": system}
        if gemini_tools:
            config_kwargs["tools"] = gemini_tools
        config = types.GenerateContentConfig(**config_kwargs)

        last_err: Exception | None = None
        for attempt in range(1, _MAX_RETRIES + 1):
            try:
                response = client.models.generate_content(
                    model=self._model, contents=contents, config=config,
                )
                return self._parse_response(response)
            except Exception as e:  # noqa: BLE001 — classify below
                last_err = e
                if attempt < _MAX_RETRIES and self._is_retryable(e):
                    delay = _BACKOFF_BASE * (2 ** (attempt - 1))
                    logger.warning(
                        "Gemini transient error (attempt %d/%d), retrying in %.0fs: %s",
                        attempt, _MAX_RETRIES, delay, e,
                    )
                    time.sleep(delay)
                    continue
                break

        logger.error("Gemini API 오류: %s", last_err, exc_info=True)
        kind, cause = self._classify_error(last_err)
        return {
            "text": f"LLM 오류: {self._friendly_error(last_err)}",
            "tool_use": None,
            "error": str(last_err) if last_err else "unknown",  # raw upstream error (admin)
            "error_kind": kind,
            "error_cause": cause,
            "model": self._model,
        }

    def _parse_response(self, response) -> dict:
        tool_use = None
        candidate = response.candidates[0] if response.candidates else None
        if candidate and candidate.content and candidate.content.parts:
            for part in candidate.content.parts:
                if hasattr(part, "function_call") and part.function_call:
                    fc = part.function_call
                    tool_use = {
                        "name": fc.name,
                        "input": dict(fc.args) if fc.args else {},
                        "id": fc.name,
                    }
                    break

        # function_call만 있는 경우 parts에 text가 없으므로 ""
        text = ""
        if candidate and candidate.content and candidate.content.parts:
            for part in candidate.content.parts:
                if hasattr(part, "text") and part.text:
                    text += part.text

        logger.debug("Gemini 응답 — text=%r tool=%s", text[:80] if text else "", tool_use["name"] if tool_use else None)
        return {"text": text, "tool_use": tool_use}

    @staticmethod
    def _is_retryable(e: Exception) -> bool:
        msg = str(e).lower()
        return any(marker in msg for marker in _RETRYABLE_MARKERS)

    def _classify_error(self, e: Exception | None) -> tuple[str, str]:
        """Return (kind, 한국어 원인 설명) for admin diagnostics."""
        msg = str(e) if e else ""
        low = msg.lower()
        if "503" in msg or "unavailable" in low or "overloaded" in low or "high demand" in low:
            return ("overloaded",
                    "Gemini 서버 과부하(503 UNAVAILABLE). 전 세계 요청이 몰려 모델이 일시적으로 "
                    "응답하지 못하는 상태입니다. 무료/공유 등급에서 특히 자주 발생하며, 보통 수초~수분 "
                    "내에 자동 해소됩니다. (백엔드는 지수 백오프로 3회 자동 재시도 후 실패 시 이 오류를 표시)")
        if "429" in msg or "quota" in low or "rate limit" in low or "resource_exhausted" in low:
            return ("rate_limit",
                    "요청 한도 초과(429 / quota). 분당·일일 요청 수 또는 토큰 한도를 넘었습니다. "
                    "사용량이 리셋되거나 한도를 상향해야 합니다.")
        if "api_key_invalid" in low or "api key not valid" in low or "permission" in low or "401" in msg or "403" in msg:
            return ("auth",
                    "인증 오류. API 키가 유효하지 않거나 권한이 없습니다. 설정의 Gemini API 키를 확인하세요.")
        if "not_found" in low or "no longer available" in low or "404" in msg:
            return ("model_not_found",
                    f"모델({self._model})을 찾을 수 없거나 더 이상 제공되지 않습니다. 컨트롤러에서 모델명을 확인하세요.")
        if "deadline" in low or "timeout" in low:
            return ("timeout", "응답 시간 초과. 네트워크 지연 또는 모델 응답 지연입니다.")
        return ("other", "분류되지 않은 LLM 오류입니다. 아래 원문을 확인하세요.")

    def _friendly_error(self, e: Exception | None) -> str:
        msg = str(e) if e else "알 수 없는 오류"
        low = msg.lower()
        if "503" in msg or "unavailable" in low or "overloaded" in low or "high demand" in low:
            return "AI 모델이 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요."
        if "NOT_FOUND" in msg or "no longer available" in low:
            return f"모델({self._model})을 사용할 수 없습니다. 관리자에게 문의하세요."
        if "API_KEY_INVALID" in msg or "api key not valid" in low:
            return "API 키가 유효하지 않습니다. 설정에서 Gemini API 키를 확인해주세요."
        if "quota" in low or "rate" in low or "429" in msg:
            return "API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요."
        return msg
