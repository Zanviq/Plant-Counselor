# AI 연동

> LLM과의 통신 계층 구조. 백엔드 안에서 동작.

관련 문서: [[Web/03_LLM/LLM_흐름]], [[Web/03_LLM/Skill_개요]], [[Web/03_LLM/시스템_프롬프트]], [[채팅_스트리밍]]

---

## 구성 요소

### LLMClient (`app/ai/llm_client.py`)
- Google Gemini API(`google-genai` SDK)를 호출하는 단일 진입점.
- 기본 모델: `gemini-2.5-flash` (신규 API 키에서 `gemini-2.0-flash`는 차단됨)
- 책임: 메시지 형식 변환 → API 호출 → tool_use 파싱 → 스트림 토큰 전달.
- 내부에서 Anthropic 형식 → Gemini 형식으로 변환 처리:
  - `_to_gemini_messages(messages)` — 메시지 배열 변환
  - `_to_gemini_tools(tools)` — Skill 스키마를 Gemini `Tool` 형식으로 변환
- 텍스트 추출: `candidate.content.parts`를 직접 순회 (SDK warning 방지용 — `response.text` 미사용)

### PromptBuilder (`app/ai/prompt_builder.py`)
- 시스템 프롬프트 템플릿을 컨텍스트로 채워 system 메시지 문자열 생성.
- 포함 내용: 역할 선언, 오늘 날짜, 현재 화면, 정원 현황(식물 목록+통계), 핵심 모델, 행동 규칙.
- [[Web/03_LLM/시스템_프롬프트]] 문서에 구조 상세 기술.

### SkillRegistry (`app/ai/skill_registry.py`)
- 모든 Skill을 등록·dispatch.
- `build_catalog()` — Gemini function 스키마 배열 생성 (LLMClient가 Gemini 형식으로 재변환).
- `dispatch(name, args, ctx)` — 권한 검사 후 Skill 실행.
- 권한 가드: `ctx.user_id`가 `plant_id`/`bud_id`의 소유자인지 확인.

### Skill 베이스 클래스 (`app/ai/skill_base.py`)
- 속성: `name`, `description`, `parameters`(JSON Schema).
- `requires_confirmation` **없음** — 동의 확인은 LLM이 대화 흐름 안에서 처리.
- 메서드: `run(args, ctx) -> SkillResult`.
- 구현체는 도메인 서비스 메서드만 호출. DB·ORM 직접 접근 금지.

### ChatOrchestrator (`app/ai/chat_orchestrator.py`)
- 사용자 발화를 받아 다음을 수행:
  1. `PromptBuilder.build_system(ctx)` 호출.
  2. `ConversationService.get_history(scope)` — 최근 20개 메시지 로드.
  3. `LLMClient.chat(messages, tools)` 첫 번째 호출.
  4. function_call 감지 시 `SkillRegistry.dispatch()`.
  5. Skill 결과를 tool_result 메시지로 추가 후 두 번째 `LLMClient.chat()` 호출.
  6. 응답 토큰을 SSE 스트림으로 클라이언트에 전달.
  7. 종료 시 `ConversationService.append(assistant_msg)` 저장.
  8. `LogRecorder.save()` — 턴 전체 JSON 파일 저장.
- tool_result 직렬화: `json.dumps(result_data, default=str)` (직렬화 불가 타입 방어).

### LogRecorder (`app/ai/log_recorder.py`)
- 채팅 한 턴의 전체 컨텍스트를 `backend/logs/chat/YYYYMMDD_HHMMSS_userid.json`으로 저장.
- 저장 내용: `timestamp`, `user_id`, `user_input`, `system_prompt`, `history`, `llm_calls`(입출력), `skill_calls`, `events`(타임라인), `final_response`.
- 운영 환경에서는 주기적 로그 정리 필요.

---

## 데이터 흐름

```
POST /chat/message
   ↓
ChatOrchestrator.run(user, text, scope, scope_id, screen)
   ↓
[1] PromptBuilder.build_system(ctx)
[2] ConversationService.get_history(scope)
[3] LLMClient.chat(messages, tools)
        ↓ stream tokens → SSE (event: token)
        ↓ function_call 감지
[4] SkillRegistry.dispatch(name, args, ctx)
        ↓ SkillResult
[5] yield SSE (event: tool_result)
[6] LLMClient.chat(messages + tool_result)  ← 합성 응답
        ↓ stream tokens → SSE (event: token)
[7] ConversationService.append(assistant_msg)
[8] LogRecorder.save()
```

---

## Skill 권한 가드

- Skill 인자에 `plant_id`, `bud_id`가 있으면, dispatch 시 해당 객체의 `user_id == ctx.user_id`를 확인.
- 불일치하면 `error_code="forbidden"`. 사용자는 다른 사용자의 데이터에 접근 불가.

---

## LLM 키 관리

- 서버 환경 변수 `LLM_API_KEY`에 Gemini API 키 저장.
- 현재 구현: 서버 단일 키 사용 (사용자별 키 분리는 추후 기능).
- 설정 페이지의 "Gemini API 키" 입력란은 향후 사용자별 키 지원을 위한 UI (현재 미사용).
