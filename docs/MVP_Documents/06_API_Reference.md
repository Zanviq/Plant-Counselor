# 06. API Reference

모든 응답은 `{ok: true, data: ...}` 또는 `{ok: false, error: {code, message}}` 형태입니다.
공통 prefix: `http://localhost:8000/api/v1`

## 인증

### POST `/auth/signup`
- body: `{nickname, password}`
- 응답: `{ok, data:{message}}` (409 시 중복)

### POST `/auth/login`
- body: `{nickname, password}`
- 응답: `{ok, data:{access_token, token_type, user}}`
- 쿠키: `refresh_token` (HTTP-only, samesite=lax, max-age 14d)

### POST `/auth/refresh`
- 쿠키만 사용
- 응답: `{ok, data:{access_token, token_type}}`

### POST `/auth/logout`
- 쿠키 삭제

## 사용자

### GET `/me` — 현재 프로필
### PATCH `/me` — `UserUpdate` 필드 일부
### POST `/me/password` — `{old_password, new_password}`
### DELETE `/me` — `{confirm_nickname}`
### PUT `/me/api-key` — `{api_key}`

## 식물

### GET `/plants?sort=activity&include_dormant=false`
- 응답: `{items: PlantOut[]}`

### GET `/plants/{id}` — 단일 식물
### PATCH `/plants/{id}` — `PlantUpdate`
### DELETE `/plants/{id}?hard=false` — archive 또는 hard delete

## 봉우리

### GET `/buds?plant_id=&wilting_only=`
### GET `/buds/{id}` — `{bud, history}`
### PATCH `/buds/{id}` — `BudPatch{title?, detail?}` (상태/진행률은 채팅을 통해서만)

## 통계 / 캘린더

### GET `/stats/summary`
- 응답: `{active_concerns, active_schedules, harvested_this_month, wilting_count, rot_count, total_plants}`

### GET `/briefing/today` — 일일 브리핑 (캐시됨)

### GET `/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD`
- 응답: `{events: {"YYYY-MM-DD": [{id,title,status,type,detail,plant_name,plant_id},...]}}`
- from/to 형식 오류 시 400, 366일 초과 시 400
- `detail` 필드에 AI가 저장한 시간·장소 정보 포함

## 대화

### GET `/conversations/list` ← 신규
- 응답: `{conversations: ConversationSummary[]}`
- `ConversationSummary`: `{id, scope, scope_id, message_count, last_message, last_role, updated_at, created_at}`
- 메시지가 없는 빈 대화는 제외
- 대화 기록 브라우저(`/history`)에서 사용

### GET `/conversations?scope=global&scope_id=&limit=20`
- 해당 스코프의 메시지 목록 반환
- `{messages: [{id, role, text, skill_call, at}]}`

### POST `/conversations/search` — `{query, scope, scope_id, limit}`

## 알림

### GET `/notifications` — 안 읽은 알림 목록
### POST `/notifications/{id}/ack`

## 채팅 (SSE)

### POST `/chat/message`
- body: `{text, scope: "global|plant|bud", scope_id?, current_screen?}`
- 응답: `text/event-stream`
- 이벤트 종류:
  - `event: start data: {message_id}`
  - `event: tool_call data: {name, args}`
  - `event: tool_result data: {name, result: {ok, message, data}}`
  - `event: token data: {text}`
  - `event: done data: {}`
  - `event: error data: {code, message}` (LLM/네트워크 오류 시)

## 기타

### GET `/health` — `{status:"ok"}` (인증 불필요)

## 에러 코드

| HTTP | 의미 |
|------|------|
| 400 | 입력 검증 실패 |
| 401 | 인증 필요/실패 |
| 404 | 리소스 없음 또는 다른 사용자 소유 |
| 409 | 중복 (닉네임 등) |
| 500 | 서버 내부 오류 |
