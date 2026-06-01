# LLM 흐름

```text
POST /api/v1/chat/message
  -> require_user
  -> 사용자 API 키 또는 서버 fallback 키
  -> ChatOrchestrator.run()
  -> PromptBuilder.build_system()
  -> ReAct loop
       Gemini 호출
       -> tool_use이면 SkillRegistry.dispatch()
       -> 결과를 working history에 추가
       -> 다음 Gemini 호출
       -> 텍스트 응답이면 종료
  -> SSE token
  -> 대화 DB 저장
  -> JSON AI 로그 저장
```

## ReAct

- 기본 최대 단계: 10
- 빈 LLM 응답은 1회 재시도
- 단계 소진 뒤 텍스트가 없으면 도구 없이 최종 요약 호출
- Gemini 503, timeout, 일시적 500은 지수 백오프로 최대 3회 시도
- 오류 원문과 분류는 AI 로그의 `llm_errors[]`에 저장

도구 실행 결과는 Gemini function response로 working history에 추가된다. 이전
스킬에서 얻은 `plant_id`, `bud_id`, `event_id`를 다음 호출에 바로 사용할 수 있다.

## SSE

```text
start
tool_call
tool_result
token
done
```

## 로그

`backend/app/ai/log_recorder.py`는 턴별 JSON 로그를 `backend/logs/chat/`에 저장한다.
대화 기록 DB와 AI 디버그 로그 파일은 서로 다른 데이터다.

## 컨텍스트

- 최근 대화 기록 20개
- 현재 정원 통계와 식물 목록
- 앱 시간 `rs.today()`
- 현재 화면
- plant 또는 bud 스코프 이름
- 사용자 응답 톤
