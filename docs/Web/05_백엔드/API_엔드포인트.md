# API 엔드포인트

> 최종 점검: 2026-06-02

모든 사용자 API는 `/api/v1` 프리픽스를 사용한다. 별도 표기가 없으면 Supabase Bearer
JWT가 필요하다. 인증 자체는 Supabase Auth가 담당하므로 커스텀 `/auth/*` 라우터는
없다.

## 계정

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/me` | 현재 프로필 |
| PATCH | `/me` | 프로필, 톤, 정원 규칙 수정 |
| DELETE | `/me` | 계정과 사용자 데이터 삭제 |
| PUT | `/me/api-key` | 사용자별 Gemini API 키 저장 |

## 식물과 봉우리

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/plants` | 식물 목록 |
| GET | `/plants/{plant_id}` | 식물 상세 |
| PATCH | `/plants/{plant_id}` | 식물 수정 |
| DELETE | `/plants/{plant_id}` | 식물 archive, `hard=true`이면 hard delete |
| GET | `/buds` | 봉우리 목록 |
| GET | `/buds/{bud_id}` | 봉우리 상세 |
| PATCH | `/buds/{bud_id}` | 봉우리 수정 |
| DELETE | `/buds/{bud_id}` | 봉우리 삭제 |
| PATCH | `/buds/{bud_id}/progress` | 진행률 수정 |

식물과 봉우리 생성은 AI 스킬을 통해 수행한다.

## 통계와 캘린더

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/stats/summary` | 홈 통계 |
| GET | `/briefing/today` | 현재 정원 브리핑 |
| GET | `/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD` | 봉우리 마감일과 독립 일정 병합 |
| POST | `/calendar/events` | 독립 일정 생성 |
| PATCH | `/calendar/events/{event_id}` | 독립 일정 수정 |
| DELETE | `/calendar/events/{event_id}` | 독립 일정 삭제 |

## 채팅, 기록, 알림

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/chat/message` | AI 채팅 SSE 스트림 |
| GET | `/conversations/list` | 스코프별 대화 목록 |
| GET | `/conversations` | 특정 스코프 기록 |
| DELETE | `/conversations` | 특정 스코프 기록 삭제 |
| POST | `/conversations/search` | 대화 검색 |
| GET | `/notifications` | 알림 목록 |
| POST | `/notifications/{notification_id}/ack` | 알림 읽음 처리 |
| POST | `/notifications/ack-all` | 모두 읽음 처리 |

## 관리자

`/api/v1/admin/*`는 `require_admin()`으로 보호한다. 사용자, AI 로그, 관리자 알림,
런타임 설정, SQL, 타임 트래블, 스케줄러 수동 실행, 개별 데이터 삭제, ZIP 백업과
복원을 제공한다.

관리자 SQL 실행기는 `exec_admin_query` RPC로 SELECT뿐 아니라 DML과 DDL도 실행할
수 있다. UI와 RPC 권한의 노출 범위를 넓히지 않는다.

## 기타

- Health check: `GET /health`
- OpenAPI UI: `GET /docs`

## 응답

일반 성공 응답은 `{ "ok": true, "data": ... }` 형태다. 오류는 HTTP 상태 코드와
오류 본문으로 전달되며, 프론트 API 클라이언트가 네트워크 오류도 표준 오류 객체로
변환한다.
