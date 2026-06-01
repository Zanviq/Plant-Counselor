# AI 연동

## 구성

| 파일 | 책임 |
| --- | --- |
| `ai/llm_client.py` | Gemini 호출, 형식 변환, 일시 오류 재시도 |
| `ai/chat_orchestrator.py` | ReAct 루프와 SSE 이벤트 |
| `ai/prompt_builder.py` | 시스템 프롬프트 |
| `ai/skill_registry.py` | 스킬 카탈로그와 dispatch |
| `ai/permissions.py` | 스코프별 변경 권한 |
| `ai/log_recorder.py` | 턴별 JSON 로그 |
| `ai/skills/` | 20개 스킬 |

## LLMClient

- `google-genai` SDK 사용
- 기본 모델: `gemini-2.5-flash`
- Gemini function calling으로 도구 호출 파싱
- 503, timeout, 일시적 500을 지수 백오프로 최대 3회 시도

## ChatOrchestrator

기본 최대 10단계 ReAct 루프를 실행한다. 도구 호출 결과를 working history에 추가해
여러 스킬을 연속 실행하고, 마지막 텍스트를 SSE token으로 보낸다.

빈 LLM 응답은 한 번 재시도한다. 단계가 모두 소진됐는데 텍스트가 없으면 도구 없이
최종 요약을 요청한다. 매 턴의 시스템 프롬프트, LLM 호출, 스킬 결과, 오류는
`backend/logs/chat/*.json`에 기록한다.

## 키 선택

1. `profiles.encrypted_api_key`에 사용자별 키가 있으면 복호화해 사용한다.
2. 없으면 서버 `LLM_API_KEY`를 fallback으로 사용한다.
3. 사용자별 `ai_model` override가 있으면 런타임 기본 모델보다 우선한다.

사용자 키는 `KEY_ENCRYPTION_SECRET`에서 SHA-256으로 파생한 Fernet 키로 암호화한다.

## 권한

`ai/permissions.py`는 채팅 스코프별 mutation 범위를 제한한다. 조회와 생성은 비교적
넓게 허용하지만 기존 항목 수정과 삭제는 현재 plant 또는 bud 범위를 벗어나면
거부한다. calendar 스코프는 독립 일정 변경을 허용하고 기존 봉우리 변경은 제한한다.
