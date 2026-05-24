# DB 스키마

> SQLAlchemy 2.x 모델로 정의. SQLite(개발) / PostgreSQL(운영) 모두 호환.

관련 문서: [[User]], [[Plant]], [[Bud]], [[GardenState]], [[ConversationLog]], [[아키텍처_개요]]

---

## ER 다이어그램(개념)

```
users ──< plants ──< buds ──< bud_history
   │                            
   ├─< garden_states (1:1)
   ├─< conversations
   │     └─< conversation_messages
   ├─< notifications
   ├─< snapshots
   └─< llm_usage(선택)
```

---

## 공통 컬럼

- 모든 테이블에 `id` (UUID/ULID 문자열, PK), `created_at`, `updated_at`(timestamptz).
- 사용자 종속 테이블은 `user_id` FK + 인덱스.

---

## 테이블 요약

### `users`
- 인증·프로필·사용자 설정. 자세히는 [[User]].

### `garden_states`
- 사용자 1:1. 요약 캐시와 오늘의 브리핑 캐시. 자세히는 [[GardenState]].

### `plants`
- 분야 단위 식물. 자세히는 [[Plant]].
- 인덱스: `(user_id, status)`, `(user_id, last_activity_at)`.

### `buds`
- 봉우리(개별 고민/일정). 자세히는 [[Bud]].
- 인덱스: `(user_id, status)`, `(user_id, deadline)`, `(plant_id, status)`.

### `bud_history`
- 봉우리 상태 전이 이력. 컬럼: `id`, `bud_id`(FK), `from_status`, `to_status`, `at`, `reason`.
- 인덱스: `(bud_id, at)`.

### `conversations`
- 대화 스코프. 컬럼: `id`, `user_id`, `scope`(`global`/`plant`/`bud`), `scope_id`(nullable).
- 유니크: `(user_id, scope, scope_id)`.

### `conversation_messages`
- 대화 메시지. 컬럼: `id`, `conversation_id`(FK), `at`, `role`(`user`/`assistant`/`tool`), `text`, `skill_call`(JSON).
- 인덱스: `(conversation_id, at)`.

### `notifications`
- 알림 큐. 컬럼: `id`, `user_id`, `kind`, `payload`(JSON), `created_at`, `acked_at`(nullable).
- 인덱스: `(user_id, acked_at)`.

### `snapshots`
- 자동/수동 백업 스냅샷 메타. 본체는 객체 스토리지/파일 시스템.
- 컬럼: `id`, `user_id`, `kind`(`auto`/`manual`), `path`, `size`, `created_at`.

### `llm_usage` (선택)
- 호출 로그. 컬럼: `id`, `user_id`, `model`, `input_tokens`, `output_tokens`, `cost`, `at`.

---

## 마이그레이션

- **Alembic** 사용.
- 모든 스키마 변경은 마이그레이션 파일로 관리.
- 운영 적용 전 SQLite 환경에서 검증.

---

## 인덱싱 원칙

- 사용자 단위 쿼리가 압도적으로 많으므로 `user_id`를 모든 인덱스의 선행 컬럼에 둔다.
- 상태/시각/마감일 등 자주 필터링되는 열은 복합 인덱스 후속 컬럼.

---

## 삭제 정책

- 식물 삭제는 기본 **soft delete**(`status='archived'`). 봉우리도 함께 archived 처리.
- 계정 삭제는 **hard delete**(관련 행 전부 제거). 별도 확인 절차.
- rot 만료 봉우리는 `disappeared_at` 세팅으로 UI에서만 숨김(데이터는 유지).
