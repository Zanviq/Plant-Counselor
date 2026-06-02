# DB 스키마 개요

> 최종 점검: 2026-06-02

관련 문서: [[아키텍처_개요]], [[User]], [[Plant]], [[Bud]], [[GardenState]],
[[ConversationLog]]

Supabase PostgreSQL을 사용한다. 백엔드는 SQLAlchemy 모델이나 Alembic을 사용하지
않고 `supabase-py` PostgREST HTTP 클라이언트로 접근한다.

## 주요 테이블

| 테이블 | 역할 |
| --- | --- |
| `profiles` | Supabase Auth 사용자 프로필, 역할, 정원 규칙, 암호화된 API 키 |
| `plants` | 사용자별 식물 |
| `buds` | 식물별 봉우리 |
| `bud_history` | 봉우리 상태 변경 이력 |
| `garden_state` | 사용자별 정원 상태 |
| `calendar_events` | 진행률 없는 독립 일정 |
| `conversations` | 스코프별 대화 세션 |
| `conversation_messages` | 세션 메시지 |
| `notifications` | 사용자 알림 |

## 관계

```text
profiles
  ├── plants
  │     └── buds
  │           └── bud_history
  ├── garden_state
  ├── calendar_events
  ├── conversations
  │     └── conversation_messages
  └── notifications
```

관리자 백업은 위 테이블을 ZIP의 `data.json`에 기록한다. 백업 ZIP 메타데이터는
`meta.json`에 저장한다.

## 사용자 격리

- 사용자 종속 행에는 `user_id`를 사용한다.
- repository 쿼리에서 사용자 ID 필터를 강제한다.
- 서비스 롤 키는 RLS를 우회하므로 repository 필터가 실제 애플리케이션 경계다.
- 관리자 API는 별도 `require_admin()` 검사 뒤에만 전체 범위 작업을 수행한다.

## `calendar_events` 예외

현재 `calendar_events`는 Supabase PostgREST 스키마 캐시 문제 때문에
`exec_admin_query` RPC를 사용한다. repository는 값 리터럴을 escape하고 테이블명과
컬럼명을 하드코딩한다. 스키마 캐시가 정상 노출되면 일반 PostgREST 방식으로 전환할 수
있다.

## 마이그레이션

현재 저장소에는 독립 일정용 `backend/migrations/001_calendar_events.sql`과 독립 일정
색상용 `backend/migrations/003_calendar_event_color.sql`이 있다. `calendar_events.color`
에는 `olive`, `blue`, `yellow`, `red`, `pink`, `purple`만 저장한다. 스키마 변경은
Supabase에 적용할 SQL과 코드 변경을 함께 관리한다.

봉우리 생애주기는 `backend/migrations/004_remove_seed_bud_status.sql`을 적용해 과거
`seed` 행을 `bud`로 승격하고 `buds.status` 기본값도 `bud`로 바꾼다. 애플리케이션은
migration 적용 전 과거 행을 읽을 때도 `seed`를 `bud`로 호환 처리한다.

## 삭제

- 식물 삭제 기본 동작은 archive다.
- 봉우리 삭제는 hard delete다.
- 계정 삭제는 사용자 종속 데이터, AI 로그, 프로필, Supabase Auth 사용자 삭제를
  순서대로 시도한다.
- 관리자 복원은 기존 PK를 덮어쓰지 않는다.
