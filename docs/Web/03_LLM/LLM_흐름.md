# LLM 흐름

> 사용자 발화 → LLM → Skill → 응답의 전체 파이프라인. 웹 환경에서 SSE로 스트리밍.

관련 문서: [[Web/03_LLM/시스템_프롬프트]], [[Web/03_LLM/Skill_개요]], [[Web/01_페이지/공통_AI대화창]], [[Web/05_백엔드/AI_연동]], [[채팅_스트리밍]]

---

## 전체 파이프라인

```
[Browser] POST /chat/message {text, scope, scope_id, current_screen}
       │
       ▼
[Backend] ChatOrchestrator
   ├─ PromptBuilder.build_system(ctx)          ← 시스템 프롬프트 생성
   ├─ ConversationService.get_history(scope)   ← 최근 20개 메시지
   ├─ LLMClient.chat(messages, tools)          ← Gemini API 호출
   │     ├─ stream tokens → Browser via SSE (event: token)
   │     └─ tool_use 감지 (function_call)
   ├─ [Skill 호출 시]
   │     ├─ yield event: tool_call
   │     ├─ SkillRegistry.dispatch(name, args, ctx)
   │     ├─ yield event: tool_result
   │     └─ LLMClient.chat(messages + tool_result)  ← 자연어 응답 합성
   │           └─ stream tokens → Browser via SSE
   ├─ ConversationService.append(assistant_msg)
   └─ LogRecorder.save()                        ← 턴 전체 JSON 저장
```

자세한 클래스: [[Web/05_백엔드/AI_연동]]. 스트림 포맷: [[채팅_스트리밍]].

---

## Skill 호출

- LLMClient는 Gemini function-calling 형식으로 tool_use를 파싱.
- Skill 인자에 들어온 `plant_id`/`bud_id` 소유자를 [[Web/05_백엔드/AI_연동#Skill-권한-가드]]가 확인.
- 실행 결과는 LLM에게 function_response 형태로 돌려보내고, LLM이 자연어 응답을 합성한다.
- Skill 실행 결과는 `onToolResult` 콜백으로 프론트에 전달되어 TanStack Query 캐시를 무효화한다.

---

## 동의 처리 방식

- 코드 레벨의 `requires_confirmation` 인터셉트는 **존재하지 않는다**.
- LLM이 시스템 프롬프트의 규칙에 따라 대화 흐름 안에서 동의를 확인한다.
- 사용자가 명확히 동의("만들어", "응", "네", "좋아")하면 즉시 Skill을 호출한다.
- 같은 질문을 반복하지 않는다 — 이미 동의한 사항은 재확인 없이 실행한다.

---

## 컨텍스트 수집

- 클라이언트가 요청 바디에 `scope`, `scope_id`, `current_screen`을 포함해 전송.
- 서버는 식물/봉우리 목록, 통계 요약, 대화 이력(최근 20개)을 모아 시스템 프롬프트에 주입.

---

## 실패 처리

- LLM API 오류: `onError` 콜백으로 에러 메시지를 스트림으로 전달. 재시도 없음(Gemini SDK 내부 처리).
- Skill 실패: LLM에 실패 메시지를 전달, LLM이 사용자에게 자연어로 안내.
- 모델 없음(404): `gemini-2.5-flash`를 기본으로 사용. 신규 API 키는 2.0-flash 차단됨.

---

## 로깅

- 매 턴마다 `LogRecorder`가 `backend/logs/chat/YYYYMMDD_HHMMSS_userid.json` 저장.
- 저장 내용: 시스템 프롬프트, 대화 이력, LLM 호출 입출력, Skill 호출 결과, 이벤트 타임라인.
- 버그 재현·AI 동작 분석에 사용. 운영 환경에서는 주기적으로 정리 필요.
