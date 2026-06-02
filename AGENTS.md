# Plant Counselor - AGENTS.md

> 후속 작업자를 위한 저장소 핸드오프 문서
>
> 최종 점검: 2026-06-02
>
> 이 문서는 현재 코드 상태를 기준으로 작성했다. 오래된 설계 문서와 실제 코드가
> 충돌하면 이 문서와 실제 코드를 우선한다.

---

## 1. 프로젝트 요약

Plant Counselor는 사용자의 고민, 목표, 일정을 식물의 생애주기로 표현하는 AI 정원사
웹 서비스다.

- **식물(Plant)**: 관리 분야 또는 카테고리. 예: 취업, 건강, 공부, 일상.
- **봉우리(Bud)**: 구체적인 고민, 목표, 할 일, 추적할 일정.
- **일반 일정(Calendar Event)**: 진행률 추적이 필요 없는 약속, 예약, 리마인더.
- **AI 정원사**: 자연어 요청을 해석하고 여러 스킬을 연속 호출해 데이터를 관리한다.

봉우리는 다음 상태를 가진다.

```text
bud -> flower -> fruit -> harvested
               \
                -> wilting -> rot
```

신규 봉우리는 `bud`에서 시작한다. 진행률을 변경하면 기본적으로 `60% -> flower`,
`85% -> fruit`로 자동 전이한다. 일정 기간 활동이 없으면 APScheduler가 `wilting`, 이후 `rot` 상태로
전환한다.

수확(`harvested`)은 진행률 `100%`를 달성한 봉우리만 가능하다.
`BudService.update_status()`가 공통 도메인 규칙으로 차단하므로 `harvest_bud`와
`update_bud_status` AI 스킬도 이를 우회할 수 없다. 식물 상세 drawer의 수확 버튼도
`100%` 미만이면 비활성화한다.

`backend/migrations/004_remove_seed_bud_status.sql`은 2026-06-02 Supabase에 적용했다.
과거 `seed` 행 26개는 `bud`로 승격했고 DB 기본값도 `bud`로 바꿨다. 일부 코드의
`seed` 참조는 migration 미적용 환경을 위한 읽기 호환과 집계 방어 코드일 뿐이며,
신규 기능에서 공식 상태로 다시 노출하지 않는다.

---

## 2. 현재 구현 상태

웹 MVP의 핵심 기능은 구현되어 있다.

| 영역 | 현재 상태 |
| --- | --- |
| 랜딩 페이지와 Google 로그인 | 구현 완료 |
| Supabase Auth, 프로필 자동 생성 | 구현 완료 |
| 식물 CRUD | 구현 완료 |
| 봉우리 CRUD, 진행률, 생애주기 | 구현 완료 |
| AI 채팅 SSE 스트리밍 | 구현 완료 |
| Gemini ReAct 멀티스텝 오케스트레이션 | 구현 완료 |
| AI 스킬 | **20개** 등록 |
| 채팅 스코프 | global / plant / bud / calendar |
| 캘린더 | 봉우리 마감일 + 독립 일정 병합 표시 |
| 대화 기록 브라우저 | 구현 완료 |
| 알림 | 시듦 / 썩음 / 마감 임박 / 관리자 발송 |
| 픽셀아트 정원 | 구현 완료 |
| 테마 | light / dark / system |
| 설정 | 계정 / AI 키 / 정원 규칙 / 테마 / 정보 |
| 관리자 패널 | 구현 완료 |
| 관리자 데이터 백업과 복원 | 구현 완료 |
| 관리자 타임 트래블 | 구현 완료 |

### 문서 불일치 주의

일부 역사 자료는 최신 코드보다 오래됐다.

- `docs/MVP/`는 2026-05-27 시점 초기 웹 MVP 스냅샷이다. 제거된 SQLAlchemy 계층,
  쿠키 기반 인증, 강조색 선택, 15개 스킬 설명이 남아 있다.
- `docs/해야할일.md`는 과거 작업 메모다. 완료 여부는 이 문서의 현재 구현 상태와 실제
  코드를 우선한다.
- `docs/superpowers/plans/`는 당시 구현 계획이므로 완료 후 달라진 코드를 판단하는
  기준으로 사용하지 않는다.
- 현재 웹 MVP용 자동 테스트 묶음은 없다. `scripts/test_ui_infra.py`는 이전 Pygame
  프로토타입용이며 현재 웹 앱 회귀 테스트로 사용하면 안 된다.

최신 동작을 파악할 때는 아래 순서를 따른다.

1. 실제 코드
2. 이 문서
3. `docs/README.md`와 `docs/Web/`
4. `CLAUDE.md`의 세션 12, 13 기록
5. `docs/DEMO_GUIDE.md`
6. 나머지 문서

---

## 3. 기술 스택

| 계층 | 기술 |
| --- | --- |
| Frontend | Next.js 16.2.6, React 19.2.4, TypeScript, Tailwind CSS v4 |
| Frontend state | Zustand, TanStack Query v5 |
| Backend | FastAPI, Pydantic v2, APScheduler |
| Backend environment | Poetry dependency management, in-project `.venv` |
| Database access | `supabase-py` PostgREST HTTP |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth Google OAuth, ES256 JWKS 검증, HS256 fallback |
| LLM | Google Gemini via `google-genai` |
| User API key encryption | Fernet, `KEY_ENCRYPTION_SECRET` SHA-256 파생 키 |
| IDs | ULID |

### 중요한 결정

- 백엔드는 **SQLAlchemy와 psycopg2를 사용하지 않는다**.
- DB 연결은 `backend/app/db/supa.py`의 Supabase HTTP 클라이언트로 처리한다.
- 사용자별 데이터 격리는 repository 쿼리의 `user_id` 필터로 강제한다.
- 프론트 인증 세션은 `@supabase/supabase-js`가 localStorage에 보관한다.
- 사이드바 Google 프로필 사진은 DB 컬럼이 아니라 Supabase 세션의
  `user_metadata.avatar_url` 또는 `picture`를 `authStore` 프로필에 병합해 표시한다.
  HTTPS URL만 허용하고 사진이 없거나 로드에 실패하면 닉네임 첫 글자를 표시한다.
- Next.js 서버 측 proxy에서는 로그인 여부를 판단하지 않는다.
- AI 채팅 응답은 동기 SSE 제너레이터로 스트리밍한다.

---

## 4. 저장소 구조

```text
Plant-Counselor/
├── AGENTS.md
├── CLAUDE.md
├── README.md
├── render.yaml
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── deps.py
│   │   ├── runtime_settings.py
│   │   ├── ai/
│   │   │   ├── chat_orchestrator.py
│   │   │   ├── llm_client.py
│   │   │   ├── prompt_builder.py
│   │   │   ├── skill_registry.py
│   │   │   ├── permissions.py
│   │   │   ├── log_recorder.py
│   │   │   └── skills/
│   │   ├── routers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── schemas/
│   │   ├── db/supa.py
│   │   └── scheduler/jobs.py
│   ├── migrations/001_calendar_events.sql
│   ├── migrations/002_ai_logs.sql
│   ├── migrations/003_calendar_event_color.sql
│   ├── migrations/004_remove_seed_bud_status.sql
│   ├── requirements.txt
│   ├── poetry.lock
│   ├── pyproject.toml
│   └── run.py
│
├── frontend/
│   ├── AGENTS.md
│   ├── proxy.ts
│   ├── app/
│   ├── components/
│   ├── lib/
│   │   ├── api/
│   │   ├── store/
│   │   ├── markdown.tsx
│   │   ├── queryKeys.ts
│   │   └── status.ts
│   └── public/sprites/
│
├── assets/sprites/
├── scripts/
└── docs/
```

### 프론트엔드 하위 지침

`frontend/` 아래 파일을 수정할 때는 `frontend/AGENTS.md`도 반드시 적용한다.

현재 프론트엔드 하위 지침의 핵심은 다음과 같다.

```text
Next.js 16은 기존 버전과 breaking change가 있으므로,
코드를 작성하기 전에 node_modules/next/dist/docs/의 관련 문서를 읽는다.
```

특히 middleware 관련 코드를 수정할 때는 Next.js 16의 `proxy.ts` 규칙을 확인한다.

---

## 5. 백엔드 구조

백엔드는 다음 계층으로 나뉜다.

```text
HTTP request
  -> router
  -> service
  -> repository
  -> Supabase PostgREST HTTP
```

| 계층 | 책임 | 예시 |
| --- | --- | --- |
| Router | 인증, HTTP 입출력, Pydantic 검증 | `routers/buds.py` |
| Service | 도메인 로직, 여러 repository 조합 | `services/bud_service.py` |
| Repository | Supabase CRUD, `user_id` 격리 | `repositories/bud_repo.py` |
| Schema | API 입출력 타입 | `schemas/bud.py` |

### 주요 진입점

- FastAPI 앱: `backend/app/main.py`
- 로컬 서버: `backend/run.py`
- 인증 의존성: `backend/app/deps.py`
- Supabase 클라이언트: `backend/app/db/supa.py`
- 런타임 설정: `backend/app/runtime_settings.py`
- 스케줄러: `backend/app/scheduler/jobs.py`

### 인증

`require_user()`는 Bearer 토큰을 검증하고 프로필을 반환한다.

1. Supabase JWKS를 가져와 ES256 또는 RS256 검증을 시도한다.
2. 실패하고 legacy JWT secret이 있으면 HS256 검증을 시도한다.
3. `sub`를 user ID로 사용해 `profiles` 테이블을 조회한다.
4. 프로필이 없으면 JWT의 이메일과 메타데이터로 fallback 생성한다.

관리자 API는 `require_admin()`으로 보호한다. 프론트 가드는 보조 수단이며 백엔드 검사가
실제 권한 경계다.

### CORS

`backend/app/main.py`는 FastAPI 인스턴스 `api`를 구성한 뒤 최종 ASGI 앱 `app`을
`CORSMiddleware`로 바깥에서 감싼다. 일반 `api.add_middleware()` 방식으로 되돌리지
않는다. 처리되지 않은 서버 예외가 발생해도 CORS 헤더를 유지해 브라우저가 실제 500
오류를 단순 CORS 실패로 오인하지 않게 하기 위함이다.

`CORS_ALLOW_ORIGIN`은 쉼표로 구분한 명시적 `http://` 또는 `https://` origin만
허용한다. `*`, `null`, 사용자 정보, 경로, query, fragment가 포함된 값은 서버 시작
시 거부한다. 이 API는 credentials를 허용하므로 wildcard origin을 다시 허용하지 않는다.
CORS 메서드는 `GET`, `POST`, `PATCH`, `PUT`, `DELETE`, 헤더는 `Authorization`,
`Content-Type`만 허용한다. 새 API가 다른 메서드나 요청 헤더를 요구하면 사용처를
확인한 뒤 명시적으로 추가한다.

### DB 접근 규칙

- 새 CRUD는 기존 repository 패턴을 사용한다.
- 일반 테이블은 `db.table("...")` PostgREST API를 사용한다.
- 쿼리에는 필요한 경우 반드시 `user_id` 필터를 넣는다.
- 직접 PostgreSQL 연결, SQLAlchemy session, psycopg2 코드를 다시 추가하지 않는다.
- `calendar_events`는 현재 예외다. Supabase PostgREST 스키마 캐시 문제로
  `exec_admin_query` RPC를 사용한다.

### `calendar_events` 예외

`backend/app/repositories/calendar_event_repo.py`는 SQL 문자열을 RPC로 전달한다.

- 값은 `_lit()`을 통해 작은따옴표를 escape한다.
- 컬럼명과 테이블명은 하드코딩한다.
- 사용자 입력을 identifier 위치에 직접 보간하지 않는다.
- 독립 일정 수정에서 관련 식물 연결을 해제할 때는 `plant_id = NULL` 업데이트를
  허용한다. router의 `model_fields_set` 확인과 repository의 `plant_id` 예외 처리를
  함께 유지한다.
- 향후 Supabase migration으로 스키마 캐시가 정상 노출되면 PostgREST 방식으로 전환할
  수 있다.

---

## 6. AI 시스템

### 요청 흐름

```text
POST /api/v1/chat/message
  -> require_user
  -> 사용자별 API 키 또는 서버 fallback 키 선택
  -> 사용자별 모델 override 또는 runtime 기본 모델 선택
  -> ChatOrchestrator.run()
  -> PromptBuilder.build_system()
  -> ReAct loop
       Gemini 호출
       -> tool_use가 있으면 SkillRegistry.dispatch()
       -> 결과를 working_history에 추가
       -> 다음 Gemini 호출
       -> 텍스트 응답이면 종료
  -> SSE token 이벤트
  -> 대화 DB 저장
  -> JSON AI 로그 저장
```

관련 파일:

- 라우터: `backend/app/routers/chat.py`
- 오케스트레이터: `backend/app/ai/chat_orchestrator.py`
- Gemini 래퍼: `backend/app/ai/llm_client.py`
- 시스템 프롬프트: `backend/app/ai/prompt_builder.py`
- 스킬 등록: `backend/app/ai/skill_registry.py`
- 세션 권한: `backend/app/ai/permissions.py`
- 로그: `backend/app/ai/log_recorder.py`

### SSE 이벤트

```text
start
tool_call
tool_result
token
done
```

프론트 수신 코드는 `frontend/lib/api/client.ts`의 `streamChat()`이다.

### ReAct 루프

- 기본 최대 단계: `llm_max_steps = 10`
- 런타임 변경 가능: `runtime_settings.py`
- 빈 LLM 응답은 1회 재시도한다.
- 루프 소진 후 텍스트가 없으면 도구 없이 최종 요약 호출을 한다.
- Gemini 503, timeout 등 일시 오류는 `llm_client.py`가 지수 백오프로 최대 3회
  시도한다.
- LLM 오류 원문과 분류는 AI 로그 JSON의 `llm_errors[]`에 남긴다.

### 등록된 AI 스킬 20개

```text
think
match_plant
create_plant
delete_plant
create_bud
update_bud_status
update_bud_progress
set_deadline
abandon_bud
harvest_bud
list_plants
list_buds
get_statistics
get_garden_briefing
search_conversation
suggest_scope_change
create_calendar_event
list_calendar_events
update_calendar_event
delete_calendar_event
```

스킬을 추가하거나 제거하면 다음도 함께 확인한다.

1. `backend/app/routers/chat.py`의 `_build_registry()`
2. `backend/app/ai/prompt_builder.py`
3. `frontend/components/chat/ChatPanel.tsx`의 `SKILLS_INFO`
4. 변이 스킬이면 `SKILL_INVALIDATIONS`
5. 세션별 권한이 필요하면 `backend/app/ai/permissions.py`
6. `docs/DEMO_GUIDE.md`

### 채팅 스코프 권한

| 스코프 | 허용 범위 |
| --- | --- |
| `global` | 전체 식물, 봉우리, 일반 일정 조회와 변경 |
| `plant` | 해당 식물의 봉우리 변경, 해당 식물 삭제 |
| `bud` | 해당 봉우리 변경 |
| `calendar` | 일반 일정 전체 변경, 봉우리는 생성과 조회만 허용 |

생성과 조회는 비교적 넓게 허용하고, 기존 항목의 수정과 삭제는
`backend/app/ai/permissions.py`가 차단한다.

### 프롬프트 수정 시 주의

시스템 프롬프트에는 다음 규칙이 이미 들어 있다.

- 의도가 충분하면 확인 질문 없이 즉시 실행
- 복합 요청은 필요하면 `think` 후 여러 스킬 연속 실행
- bud ID가 필요하면 `list_buds`로 먼저 탐색
- 일정 조회는 `list_buds`와 `list_calendar_events`를 모두 호출
- 단순 일정은 `create_calendar_event`, 추적 목표는 `create_bud`
- plant 또는 bud 세션의 주제와 다른 요청은 `suggest_scope_change`
- 답변은 Markdown으로 작성

규칙을 추가할 때 기존 규칙과 충돌하지 않는지 먼저 확인한다.

---

## 7. 프론트엔드 구조

### 라우트

| 경로 | 역할 |
| --- | --- |
| `/` | 랜딩 페이지 |
| `/login` | Google OAuth 로그인 |
| `/home` | 요약 대시보드 |
| `/plants` | 픽셀아트 정원과 식물 리스트 |
| `/plants/[id]` | 식물 상세, 봉우리 목록, 봉우리 상세 drawer |
| `/calendar` | 월간 캘린더, 일반 일정 직접 추가 |
| `/history` | 스코프별 대화 기록 |
| `/settings` | 계정, AI 키, 정원 규칙, 테마 |
| `/admin` | 관리자 대시보드 |
| `/admin/users` | 사용자 관리 |
| `/admin/logs` | AI 로그 브라우저 |
| `/admin/notifications` | 관리자 알림 발송 |
| `/admin/data` | 개별 삭제, 백업, 복원 |
| `/admin/controller` | 런타임 설정, SQL, 타임 트래블 |

### 상태 관리

| 상태 | 위치 | 용도 |
| --- | --- | --- |
| 서버 데이터 | TanStack Query | plants, buds, stats, calendar, notifications |
| 인증 | `lib/store/authStore.ts` | access token, profile |
| 채팅 | `lib/store/chatStore.ts` | 열림 상태, scope, 너비, 세션 이관 |
| 테마 | `lib/store/themeStore.ts` | mode, resolved mode, DOM 반영 |

### Query key 규칙

TanStack Query key는 `frontend/lib/queryKeys.ts`의 `QK` 팩토리를 우선 사용한다.

```ts
QK.plants()
QK.plant(id)
QK.buds()
QK.plantBuds(plantId)
QK.bud(id)
QK.summary()
QK.briefing()
QK.calendar(year, month)
```

같은 데이터를 서로 다른 key로 조회하면 페이지 이동 시 캐시가 재사용되지 않는다.
새 UI를 추가할 때 기존 key와 맞춰야 한다.

### 채팅 패널

`frontend/components/chat/ChatPanel.tsx`는 다음을 담당한다.

- SSE 수신과 메시지 표시
- 스코프별 대화 기록 로드
- 스킬 실행 이후 관련 query cache 무효화
- `/clear`, `/delete`, `/compact`, `/plants`, `/new`, `/settings`, `/skills`, `/use`
- 채팅 너비 드래그 조절
- 세션 불일치 변경 배너
- 브레드크럼 세션 이동
- AI Markdown 렌더링

변이 스킬을 추가하면 `SKILL_INVALIDATIONS`에 영향받는 캐시를 등록한다.

### Markdown 렌더러

AI 답변은 `frontend/lib/markdown.tsx`의 자체 렌더러로 표시한다.

- `react-markdown`은 Turbopack dev 런타임에서 ESM 로드 문제가 있어 제거됐다.
- ChatPanel과 `/history`는 동일 렌더러를 공유한다.
- 링크는 `safeHref()`로 `javascript:`와 `data:` URI를 차단한다.
- 외부 Markdown 의존성을 다시 추가하려면 dev, build, start 세 환경을 모두 검증한다.

### 인증 흐름

- 브라우저 Supabase 클라이언트: `frontend/lib/supabase.ts`
- 일반 앱 가드: `frontend/app/(app)/layout.tsx`
- 관리자 가드: `frontend/app/admin/layout.tsx`
- Next.js 16 pass-through proxy: `frontend/proxy.ts`

Supabase 세션은 localStorage 기반이므로 `proxy.ts`에서 쿠키를 검사하면 안 된다.

---

## 8. 캘린더와 시간 처리

캘린더에는 두 종류의 항목이 함께 표시된다.

| 종류 | 저장 위치 | 특징 |
| --- | --- | --- |
| 식물 일정 | `buds.deadline` | 진행률과 생애주기 있음 |
| 일반 일정 | `calendar_events` | 진행률 없음, 단순 약속과 예약 |

일반 일정은 `color`에 `olive`, `blue`, `yellow`, `red`, `pink`, `purple` 중 하나를
저장한다. 기본값은 기존 강조색과 같은 `olive`다. 프론트 일정 modal과 AI 일정 스킬은
같은 팔레트 ID를 사용하며 임의 CSS 색상 문자열은 저장하지 않는다.

`GET /api/v1/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD`는 두 종류를 병합하고
`source: "bud" | "event"`로 구분한다.

### 앱 시간

`backend/app/runtime_settings.py`의 `rs.now()`와 `rs.today()`를 사용한다.

- 기본 앱 타임존: UTC+9, KST
- 타임 트래블: `time_offset_seconds`
- 스케줄러와 AI 프롬프트는 가상 시간을 반영한다.
- 백업 파일명과 로그 파일명처럼 외부 artifact 생성 시간은 실제 시간을 사용한다.

사용자에게 보이는 날짜 로직을 추가할 때 `datetime.utcnow()`를 직접 쓰기 전에
`rs.now()` 또는 `rs.today()`가 맞는지 먼저 판단한다.

---

## 9. 알림과 자동 전이

`TransitionService.scan_all()`은 각 사용자 프로필의 `garden_rules`를 적용한다.

기본값:

```text
wilting_days = 7
rot_disappear_days = 14
deadline_warn_days = 3
auto_transition = true
```

스케줄러는 기본 10분마다 실행된다.

1. 장기간 변화 없는 활성 봉우리를 `wilting`으로 변경
2. 오래 시든 봉우리를 `rot`으로 변경
3. 마감 임박 봉우리에 `deadline_warning` 알림 생성

마감 임박 알림은 동일 봉우리의 미확인 알림이 있으면 중복 생성하지 않는다.

관리자 컨트롤러에서 타임 트래블 후 수동 스캔을 실행할 수 있다.

---

## 10. 관리자 기능

모든 `/api/v1/admin/*` 엔드포인트는 `require_admin`으로 보호한다.

주요 기능:

- 서비스 통계
- 사용자 목록, 상세, 역할 변경
- 사용자별 AI 모델 override
- AI 로그 파일 조회
- 사용자별 또는 전체 알림 발송
- 대화, 로그, 식물, 봉우리 개별 또는 일괄 삭제
- 전체 데이터 ZIP 백업
- 기존 PK를 덮어쓰지 않는 복원
- 런타임 설정 변경과 snapshot 저장
- SQL 실행기
- 타임 트래블
- 스케줄러 수동 실행

### 관리자 SQL 실행기

`/admin/controller/sql`은 `exec_admin_query` RPC를 통해 임의 SQL을 실행한다.

- 관리자 전용 기능이다.
- 호출 시 관리자 ID와 쿼리를 audit log에 남긴다.
- SELECT 전용이 아니다. DML과 DDL도 가능하다.
- 관리자 UI 또는 RPC 권한을 수정할 때 위험 범위를 축소하지 않은 채 노출 범위를
  넓히지 않는다.

### 백업

`backend/app/services/backup_service.py`는 ZIP 파일을 `backend/backups/`에 저장한다.

- `meta.json`: 버전, 생성 시각, 테이블별 행 수
- `data.json`: 전체 테이블 데이터
- restore는 동일 PK를 덮어쓰지 않고 건너뛴다.
- `calendar_events`는 RPC 방식으로 덤프하고 복원한다.

---

## 11. 로컬 실행

### 백엔드

```bash
cd backend
poetry config virtualenvs.in-project true --local
poetry install
# backend/.env 파일을 직접 생성하고 아래 환경변수를 입력한다.
poetry run python run.py
```

`backend/pyproject.toml`은 Poetry의 `package-mode = false`를 사용한다. 이 백엔드는
배포용 Python 패키지가 아니라 `app.main`을 직접 실행하는 서비스이므로 root package를
설치하지 않는다. `poetry.toml`은 머신별 로컬 설정이라 gitignore 대상이며,
`poetry.lock`은 재현 가능한 의존성 설치를 위해 저장소에 포함한다.

백엔드 주소:

```text
http://localhost:8000
http://localhost:8000/docs
http://localhost:8000/health
```

### 프론트엔드

```bash
cd frontend
npm install
npm run dev
```

프론트엔드 주소:

```text
http://localhost:3000
```

### 백엔드 환경변수

현재 저장소에는 `backend/.env.example`이 없다. `backend/.env`를 직접 생성한다.

```dotenv
DATABASE_URL=...
SUPABASE_URL=...
SUPABASE_JWT_SECRET=...
SUPABASE_SERVICE_ROLE_KEY=...
LLM_API_KEY=...
KEY_ENCRYPTION_SECRET=...
CORS_ALLOW_ORIGIN=http://localhost:3000
```

`DATABASE_URL`은 과거 호환 설명을 위해 남아 있지만 현재 일반 CRUD는 Supabase HTTP를
사용한다.

### 프론트엔드 환경변수

```dotenv
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_BASE=http://localhost:8000/api/v1
```

### 비밀값 주의

- `backend/.env`와 `frontend/.env.local`은 gitignore 대상이다.
- 실제 Supabase key, Gemini key, 암호화 secret을 문서, 로그, 커밋에 넣지 않는다.
- 관리자 SQL 실행 결과를 공유할 때도 사용자 개인정보와 암호화된 키를 제거한다.

---

## 12. 검증 방법

현재 웹 MVP 전용 자동 테스트는 부족하다. 기능 변경 후 최소한 다음을 수행한다.

### 프론트엔드 정적 검증

```bash
cd frontend
npm run lint
npm run build
```

2026-06-02 기준 `npm run lint`는 기존 프론트엔드 코드에서 실패한다. 현재 기준선은
6 errors, 9 warnings이며 주요 오류는 effect 내부의 동기 `setState`, 선언 전
`sendText` 참조, JSX 내 escape되지 않은 따옴표다. 기능 변경 시 새 오류를 추가하지
말고, 관련 파일을 수정한다면 함께 정리한다.

### 백엔드 기본 검증

```bash
cd backend
poetry run python -m compileall app
```

### 수동 회귀 확인

관련 변경 범위에 따라 `docs/DEMO_GUIDE.md`의 시나리오를 사용한다.

2026-06-01 로그인 후 Codex 인앱 브라우저로 스모크 테스트했다. `/home`, `/plants`,
`/calendar`, `/history`, `/settings`, `/plants/{id}`와 공통 AI 패널이 정상
렌더링됐고 확인 범위에서 브라우저 콘솔 warning 또는 error는 없었다. 테스트 계정에는
`테스트` 식물 1개와 일정 봉우리 1개가 있다. 홈 통계는 진행 중 일정 1개로
표시하지만 캘린더의 2026년 6월 배치 일정은 0개다. 마감일 없는 일정 봉우리의 의도된
처리인지 캘린더 병합 누락인지 관련 변경 시 확인한다.

최소 확인 항목:

1. 로그인 후 일반 사용자 `/home` 진입
2. 식물 생성과 봉우리 생성 후 화면 즉시 반영
3. 봉우리 진행률 변경 후 상태 자동 전이
4. 캘린더의 봉우리 일정과 일반 일정 병합 표시
5. AI 채팅 SSE 응답과 Markdown 표시
6. 세션 변경 배너와 입력 이관
7. 알림 읽음 처리와 전체 기록
8. 관리자 화면 접근 제어

### 서버 재시작

백엔드 변경 후 자동 reload가 불안정할 수 있다. 반영이 이상하면 Python 프로세스를
종료하고 서버를 수동 재시작한다.

`backend/run.py`는 다음 생성 파일을 reload 감시에서 제외한다.

```text
runtime_settings.json
logs/**
backups/**
*.json
*.zip
__pycache__/**
*.pyc
```

---

## 13. 수정 시 체크리스트

### 백엔드 API를 추가할 때

1. router에서 인증 의존성을 적용한다.
2. 도메인 로직은 service에 둔다.
3. DB 접근은 repository에 둔다.
4. 사용자 데이터 쿼리에 `user_id` 격리를 적용한다.
5. Pydantic schema와 프론트 타입을 함께 수정한다.
6. 관련 TanStack Query cache invalidation을 확인한다.

### 봉우리 상태 로직을 수정할 때

다음 파일을 함께 확인한다.

```text
backend/app/services/bud_service.py
backend/app/services/transition_service.py
backend/app/repositories/bud_repo.py
backend/migrations/004_remove_seed_bud_status.sql
frontend/lib/status.ts
frontend/app/(app)/plants/page.tsx
frontend/app/(app)/plants/[id]/page.tsx
```

### AI 스킬을 수정할 때

다음 파일을 함께 확인한다.

```text
backend/app/ai/skills/
backend/app/routers/chat.py
backend/app/ai/prompt_builder.py
backend/app/ai/permissions.py
frontend/components/chat/ChatPanel.tsx
docs/DEMO_GUIDE.md
```

### 캘린더를 수정할 때

다음 파일을 함께 확인한다.

```text
backend/app/routers/stats.py
backend/app/services/calendar_service.py
backend/app/repositories/calendar_event_repo.py
backend/migrations/001_calendar_events.sql
backend/migrations/003_calendar_event_color.sql
frontend/lib/api/stats.ts
frontend/app/(app)/calendar/page.tsx
```

### 인증을 수정할 때

다음 파일을 함께 확인한다.

```text
backend/app/deps.py
frontend/lib/supabase.ts
frontend/lib/api/client.ts
frontend/app/(app)/layout.tsx
frontend/app/admin/layout.tsx
frontend/proxy.ts
```

localStorage 기반 세션과 서버 cookie 인증을 섞지 않는다.

---

## 14. 알려진 개선 후보

현재 코드와 `CLAUDE.md`를 기준으로 남아 있는 개선 후보:

- 식물 이름과 설명 직접 편집 UI
- 봉우리 제목과 detail 인라인 편집 UI
- 시간 문자열 HH:MM 정규화
- 봉우리 정렬 옵션
- 모바일 반응형 레이아웃
- 봉우리의 다른 식물 이동
- 반복 일정
- 통계 차트
- 웹 MVP 자동화 테스트
- 오래된 MVP 문서 정리

기능 추가 전에 이미 구현된 API가 있는지 먼저 확인한다. 예를 들어 식물 수정 API와
봉우리 patch API는 존재하지만 사용자 UI가 충분하지 않다.

---

## 15. 주의할 함정

- `frontend/proxy.ts`에 서버 측 로그인 redirect를 다시 넣지 않는다.
- `calendar_events`를 다른 테이블과 동일하게 PostgREST로 호출한다고 가정하지 않는다.
- 채팅 로그 JSON과 대화 기록 DB를 혼동하지 않는다.
- 로그 삭제가 대화 기록 삭제를 의미하지 않는다.
- 대화 기록 삭제가 로그 파일 삭제를 의미하지 않는다.
- 프론트 mutation 뒤에는 관련 query key 무효화를 확인한다.
- 정원 화면의 잔디 레이어가 버튼을 덮지 않도록 z-index를 유지한다.
- AI Markdown 렌더러를 ChatPanel과 `/history`에서 따로 구현하지 않는다.
- 사용자 표시 날짜에 UTC를 직접 적용하지 않는다.
- `.env` 파일과 실제 키를 커밋하지 않는다.

---

## 16. 참고 문서

| 문서 | 용도 |
| --- | --- |
| `CLAUDE.md` | 과거 세션별 변경 이력과 맥락 |
| `README.md` | 로컬 실행과 배포 시작점 |
| `docs/README.md` | 최신 문서와 역사 자료 구분 |
| `docs/DEMO_GUIDE.md` | 기능별 수동 테스트 시나리오 |
| `docs/DEPLOYMENT_GUIDE.md` | Vercel, Render, Supabase 배포 |
| `docs/superpowers/specs/2026-05-24-multi-step-orchestrator-design.md` | ReAct 루프 설계 배경 |
| `frontend/AGENTS.md` | Next.js 16 작업 시 추가 지침 |

---

## 17. 작업 시작 전 빠른 점검

후속 작업자는 코드 수정 전에 다음을 확인한다.

```bash
git status --short --branch
rg --files -g 'AGENTS.md' -g 'CLAUDE.md'
```

그 다음 작업 범위에 맞는 파일과 관련 문서를 읽는다. 기존 사용자 변경이 있으면
되돌리지 말고 함께 반영한다. 기능 구현 후에는 변경 범위에 맞는 lint, build, compile,
수동 회귀 확인을 수행한다.

---

## 18. 협업과 Git 운영 규칙

이 저장소의 `AGENTS.md`는 후속 AI와 도구가 참고하는 지속적인 작업 가이드다.

### 변경 사항 문서화

- 새 기능, 구조 변경, 중요한 버그 수정, 운영상 주의사항이 생기면 같은 작업에서 이
  문서도 함께 갱신한다.
- 단순 문구 수정처럼 후속 작업 판단에 영향을 주지 않는 변경은 기록을 생략할 수 있다.
- 실제 코드와 문서가 충돌하지 않도록 작업 완료 전에 관련 섹션을 확인한다.
- 기존 설명이 오래되면 새 항목만 덧붙이지 말고 기존 내용을 현재 상태에 맞게 수정한다.
- 문서를 현대화할 때 오래된 구현 설명은 제거하되, 여전히 유효한 구조, 보안 경계,
  운영 주의사항, 확장 체크리스트까지 함께 지우지 않는다. 상세를 줄이면 같은 문서
  또는 명확히 연결된 최신 문서에서 후속 작업자가 찾을 수 있게 보존한다.

### Figma와 프론트 동기화

- 기존 Figma 기획과 실제 프론트 사이의 시각적, 구조적 차이를 화면별로 점진적으로
  줄여 나간다. 전체 UI를 한 번에 교체하지 않는다.
- UI 수정 전 대상 Figma 화면의 URL 또는 파일 키와 노드 ID를 확보하고, Figma MCP의
  디자인 컨텍스트와 스크린샷을 읽어 현재 프론트 화면과 비교한다.
- 화면 단위 수정 후 관련 라우트를 Codex 인앱 브라우저에서 다시 확인한다.
- 기준 Figma 파일은
  `https://www.figma.com/design/1zp2zhoM4lTb56iIJfpI1m/Plant-Counselor?node-id=4-23`이다.
- 사이드바 기준 프레임은 `31:3`이며, 프론트 구현은
  `frontend/components/layout/Sidebar.tsx`다.
- 사이드바 아이콘은 Figma와 동일한 공식 라이브러리 SVG path를 직접 사용한다.
  홈, 캘린더, 기록, AI, 알림, 설정은 Lucide 계열이고 식물은 Tabler 계열이다.
  Figma MCP 임시 asset URL은 만료되므로 프론트 코드에 직접 넣지 않는다.
- 사이드바 버튼은 40px 프론트 버튼과 44px Figma 버튼 안에서 아이콘을 18px로
  표시한다. 프론트 SVG는 `strokeWidth="1.6"`과 `currentColor`를 사용하고, 기본
  아이콘 색은 `--sidebar-fg` (`#C5CDB8`)를 유지한다. Figma 원본도 18px 중앙 배치와
  같은 기본 stroke 색으로 맞춘다.
- AI 패널 토글은 사이드바의 `AI 정원사` 버튼 하나만 제공한다. 공통 앱 레이아웃의
  우측 상단 floating FAB는 중복이므로 다시 추가하지 않는다. 키보드 Space 단축키와
  각 화면의 맥락별 상담 진입점은 유지한다.
- 사이드바 알림 팝오버의 목록 영역은 최대 `210px` 높이를 사용한다. 접히지 않은
  기본 알림은 3개까지 자연스럽게 표시하고, 4개부터 목록 내부 `overflow-y: auto`
  스크롤로 확인한다. 알림 상세를 펼쳤을 때도 팝오버 전체가 계속 늘어나지 않는다.
- 캘린더 페이지는 달력 아래에 선택 날짜 일정을 다시 길게 반복 표시하지 않는다.
  일정 추가 진입점은 오른쪽 열 하단의 버튼 하나만 유지하고 헤더 우측에는 두지 않는다.
- 일반 일정 추가, 수정 modal은 올리브, 파랑, 노랑, 빨강, 분홍, 보라 6개 팔레트 중
  하나를 선택한다. 달력 점과 선택 날짜 일정 카드의 점은 저장된 색상을 사용한다.
  봉우리 마감 일정은 사용자 선택색이 아니라 기존 생애주기 상태 색상을 유지한다.
- 캘린더 오른쪽 열은 월간 달력 카드 높이에 맞춘다. `선택 날짜 일정` 목록은 남는
  높이를 사용하고 일정이 많으면 내부 스크롤로 확인한다. 기본 선택값은 오늘이며,
  달력 날짜를 누르면 오른쪽 목록을 해당 날짜 일정으로 교체한다. 독립 일정은
  추가, 수정, 삭제할 수 있고 봉우리 일정은 클릭하면 해당 식물 상세의 봉우리
  drawer로 이동한다. 하단 통계는 Figma처럼
  `일정 상태 요약` 컨테이너 안에서 세로 강조 바가 있는 4개 카드로 표시한다. 내부
  카드는 Figma 요약 카드와 동일한 `--calendar-stat-bg` (`#FAFCF7`) 표면을 사용하고 바깥
  컨테이너는 `--bg-elevated`로 유지해 한 단계 구분한다. 일정, 고민, 주의, 수확은
  각각 accent, info, warning, positive 색으로 구분한다.
- 캘린더 페이지는 `1920x1080`, 브라우저 75% 축소 환경에서 세로 스크롤 없이 한
  화면에 들어와야 한다. 현재 기준은 페이지 패딩 `24px`, 월간 달력과 오른쪽 열
  고정 행 높이 `480px`, 날짜 셀 `minHeight: 56px`, 하단 요약 카드 `minHeight: 96px`다.
  일정이 많아질 때는 페이지 전체가 늘어나는 대신 `선택 날짜 일정` 목록 내부에서
  스크롤한다.
- `선택 날짜 일정` 카드와 오른쪽 열은 `overflow: hidden`을 유지하고 목록 `<ul>`은
  `flex: 1`, `min-height: 0`, `overflow-y: auto`를 사용한다. 이 제약을 빼면 일정
  개수에 따라 오른쪽 열과 월간 달력 카드 높이가 함께 늘어난다. 상위 2열 Grid의
  `grid-template-rows: 480px`도 제거하지 않는다.
- 앱 공통 색상은 프론트의 `frontend/app/globals.css` 토큰을 기준으로 삼는다. Figma의
  `03 App Screens`도 배경 `#F5F2EB`, 사이드바 `#3D4A30`, 기본 테두리 `#DDD9CE`,
  기본 강조색 `#5C6B3F` 계열로 동기화했다. 이후 색을 조정하면 프론트 토큰을 먼저
  수정하고 관련 Figma 화면에 반영한다.
- 테마 설정은 light, dark, system 모드만 제공한다. 별도 강조색 선택 기능과
  `data-accent` DOM 속성은 제거했으므로 다시 추가하지 않는다. 이전 로컬 저장값에
  강조색이 남아 있어도 초기화 과정에서 속성을 제거한다.
- 대화 기록 `/history`의 왼쪽 목록은 스코프 계층을 시각적으로 유지한다. 전체 대화는
  message-circle, 캘린더는 calendar, 식물은 sprout, 일정 봉우리는 calendar, 고민
  봉우리는 stage dot 아이콘을 이름 앞에 표시한다. 식물 아래 봉우리는 들여쓰기
  가이드로 연결하고, 식물 행의 보조 문구는 최근 메시지 미리보기보다 하위 봉우리
  개수를 우선 표시한다.
- Figma의 대화 기록 화면 8개 변형은 현재 프론트 레이아웃 기준으로 동기화했다.
  `1920px` 화면에서 기록 셸은 채팅 패널 열림 여부와 관계없이 `1128px` 폭을 유지하고,
  내부는 트리 `280px`, 상세 `848px`로 나눈다. 셸은 닫힘 상태에서 본문 기준
  `x=364`, 열림 상태에서 `x=164`, 공통 `y=104`, `height=952`다.
- Figma의 `Plant-Counselor / Light` 변수 컬렉션은 프론트 `globals.css` 토큰과
  동기화했다. Figma 화면의 공통 색을 바꿀 때 개별 레이어를 임의 색으로 덮기 전에
  해당 변수 값으로 반영할 수 있는지 먼저 확인한다.
- 로그인 전 랜딩 페이지 하단의 `지금 바로 정원을 시작하세요` CTA에는 별도 로고를
  두지 않는다. 헤더와 푸터의 브랜드 로고는 유지한다.
- 로그인 전 랜딩 페이지는 `header`, 단일 `main`, `footer` 랜드마크 구조를 유지한다.
  미리보기와 기능 섹션을 수정할 때 `<main>` 밖으로 본문 섹션을 빼지 않는다.
- 로그인 전 랜딩 `#preview`의 `나의 정원` 예시는 실제 `/plants`의 픽셀 규칙을
  따른다. 오래된 `plant.png + 6개 슬롯` 합성이나 `sky.png`, `grass.png` 배경으로
  되돌리지 않는다. 화분은 한 번만 렌더링하고 예시 봉우리마다 `64px` 성장 레이어를
  위로 쌓는다. 화분 바닥은 실제 정원처럼 고정된 잔디 기준선에 맞추고, 배경은 현재
  정원의 연한 하늘 그라데이션, 연한 잔디, 본 잔디, 전경 잔디 레이어를 사용한다.
  랜딩 카드에서는 식물 아래의 잔디 깊이를 얕게 크롭해 식물이 화면 아래에 묻히거나
  불필요하게 넓은 지면이 보이지 않게 유지한다. 화분 아래에는 실제 정원처럼 식물명,
  상태 pill, 봉우리 수, `상세`·`상담` 액션이 있는 흰색 정보 카드를 함께 표시한다.
  식물 픽셀과 정보 카드는 `frontend/components/plants/GardenPlantVisual.tsx`의
  `GardenPlantVisual` 합성 컴포넌트를 `/plants`와 랜딩이 함께 사용한다.
  랜딩에서 모양을 비슷하게 다시 그리는 별도 구현을 만들지 않는다. 랜딩 예시에서도
  식물과 정보 카드는 실제 크기를 유지하고, 좁은 카드에 맞추기 위해 식물만 따로
  축소하지 않는다. 지형은 실제 정원의 기준선 주변을 얕게 크롭한다. 익명 랜딩의
  시스템 테마가 dark여도 정원 예시는 실제 라이트 정원 토큰으로 표시하며, 식물들은
  퍼센트 좌표가 아니라 하나의 중앙 정렬 그룹으로 배치한다. 오른쪽 정원 미리보기는
  왼쪽 채팅 카드와 같은 높이로 늘어나며, 늘어난 영역은 하늘로 사용한다. 지면과 식물
  기준선은 카드 하단 기준으로 고정한다. 카드 아래에는 얕은 잔디 여백을 남기되
  불필요하게 깊은 땅이 보이지 않게 유지한다.
- 정원 `/plants`의 정원 보기는 Figma `03 App Screens`의 `Plant / View / Garden`
  프레임과 `05 Plant Pixel Assets` 가이드를 따른다. 작은 카드 안의 고정 합성
  `plant.png`와 6개 슬롯 방식으로 되돌리지 않는다. 화면은 상단 HUD가 있는 넓은
  양방향 스크롤 잔디 보드이며 리스트 보기는 별도로 유지한다.
- 정원 화면의 좌측 상단 제목 HUD 아래에는 `정원`, `리스트` 전환 HUD만 둔다.
  별도의 `N개 식물`, `시듦 N` 요약 HUD와 우측 상단 전환 HUD를 다시 추가하지 않는다.
- 정원 화면의 우측 하단에는 `50%`, `75%`, `100%`, `125%`, `150%`, `175%`,
  `200%` 배율을 선택하는 확대, 축소 HUD를 둔다. 가운데 배율 버튼은 `100%`로
  초기화한다. HUD는 고정하고 내부
  보드만 확대하거나 축소하며, 스크롤 영역의 실제 크기와 선택 식물 자동 스크롤도
  배율에 맞춰 함께 보정한다. 트랙패드 pinch가 브라우저에서 생성하는 `ctrlKey` wheel
  이벤트도 정원 연속 배율 변경으로 처리하고, 제스처 중심 좌표를 유지한다. 축소된
  보드의 논리 폭과 높이는 현재 뷰포트를 채우는 최소 크기보다 작아지지 않게 계산해
  빈 정원에서도 오른쪽 또는 아래 배경이 끊기지 않게 한다.
- 정원 페이지는 SSR과 첫 hydration 렌더에서 항상 정원 스켈레톤을 표시한다.
  `useSyncExternalStore`로 hydration 완료를 확인한 뒤 Supabase access token이 있을
  때만 plants, buds query를 활성화한다. 서버의 비인증 빈 정원 HTML과 브라우저의
  세션 복원 직후 로딩 HTML이 충돌하지 않게 하기 위함이다.
- 식물이 없는 정원 모드도 동일한 풀스크린 잔디 보드를 렌더링한다. 첫 번째 자리에는
  `첫 식물 심기` 버튼을 두고 AI 채팅을 연다. 일반 빈 상태 카드는 리스트 모드에서만
  사용한다.
- 정원 식물은 화분을 맨 아래에 한 번만 렌더링하고, 사라지지 않은 봉우리마다
  `no-pot extension` 성장 레이어를 하나씩 위로 쌓는다. 줄기 하나에 봉우리 하나가
  대응하므로 봉우리가 삭제되어 `disappeared_at`이 설정되면 해당 줄기도 함께
  사라진다. 고정 최대 개수 제한을 두지 않고 레이어 수에 따라 보드 높이를 늘린다.
- 정원 성장 레이어의 상태별 픽셀 표현은
  `frontend/components/plants/GardenPlantVisual.tsx`의 `GrowthLayer`가 담당한다.
  `bud`, `flower`, `fruit`, `wilting`, `rot`, `harvested` 상태를 같은 줄기
  규칙 안에서 표현하며, 변경 시 Figma `05` 에셋 가이드와 함께 확인한다. 실제
  봉우리 레이어 위에 마우스를 올리면 해당 봉우리 이름을 즉시 툴팁으로 표시한다.
  봉우리 레이어를 클릭하거나 키보드로 선택하면 `/plants/{plantId}?bud={budId}`로
  이동하고 식물 상세 화면에서 해당 봉우리 drawer를 즉시 연다. 랜딩 `#preview`는
  같은 렌더러를 사용하지만 선택 콜백을 넘기지 않아 예시 식물이 링크처럼 동작하지
  않는다.
- 신규 봉우리는 `bud` 상태로 시작하고 Figma `05 Plant Pixel Assets`의 `02 봉우리`
  no-pot extension과 같은 닫힌 봉우리 픽셀을 사용한다. `harvested`는 별도 열매나
  수확 마커를 남기지 않고 줄기와 잎만 있는 새싹 형태로 표시한다. 봉우리가 하나도
  없는 식물은 대체 새싹 레이어를 만들지 않고 화분만 표시한다. `/plants` 배치 높이도
  실제 성장 레이어 수를 사용해 화분 바닥 기준선을 유지한다.
- 정원 성장 레이어는 Figma `05 Plant Pixel Assets`의 no-pot extension 좌표를
  상태별로 그대로 따른다. Figma 합성 식물처럼 각 봉우리 성장 레이어의 방향은 식물
  ID와 무관하게 해당 봉우리 ID 해시만으로 안정적으로 섞는다. 자연스러운 무작위
  배치를 유지하되 같은 방향은 최대 3개까지만 연속되게 보정한다. 아래쪽 성장 레이어가
  위쪽 레이어보다 앞에 그려져 잎, 꽃,
  열매가 자연스럽게 겹치도록 z-index를 역순으로 쌓는다. `bud` 줄기도 다른 활성
  상태와 같은 연한 초록색을 사용하고, `wilting`은 갈변한 줄기와 잎 및 상단 굽은
  조각, `rot`는 일반 초록 줄기와 잎 위의 상한 열매를 사용한다. 잔디 덩어리와 바닥
  그림자는 보드 폭에 맞춰 끝까지 반복 생성한다. 보드 오른쪽의
  `새 식물 자리` 버튼은 global 스코프로 AI 채팅 패널을 열어 식물 추가를 요청할 수
  있게 한다.
- 봉우리 hover는 성장 레이어 오른쪽 고정 위치에서 이름 툴팁의 투명도만 바꾼다.
  hover 중에도 성장 레이어 z-index와 툴팁 위치를 바꾸지 않고, 툴팁이 위쪽 식물을
  덮지 않아 기존 겹침 순서를 시각적으로도 유지한다.
- 정원 식물은 `created_at` 오름차순으로 왼쪽부터 배치한다. 새 식물은 항상 기존
  식물 오른쪽, `새 식물 자리` 버튼 바로 앞에 추가된다. 보드 폭은 마지막 버튼과
  오른쪽 여백까지 포함해 계산하며 식물 수가 늘어나면 배경과 반복 장식도 함께
  오른쪽으로 확장한다.
- 정원 화면은 Figma의 `Infinite grass field / 2D scroll content`를 기준으로
  일반 식물 기준선을 `696px`로 두어 새 식물 자리의 `y=516` 위치를 맞춘다. 식물별
  세로 편차는 Figma 식물 열처럼 `0px`, `24px` 두 단계만 사용해 화분이 잔디 경계 밖에서 떠 보이지
  않게 한다. 두 행이 겹치는 부분은 지면 깊이에 맞춰 `0px` 뒤쪽 행, `10px` 앞쪽
  행 순서로 z-index를 쌓고 선택 식물만 최상단으로 올린다. 선택 식물 이동 시 바닥
  아래에 약 `240px`의 화면 여백을 확보한다.
  Figma의 `1580px` 고정 필드는 실제 브라우저에서 식물 아래 잔디가 과도하게 길어져
  기본 최소 높이를 `1160px`로 조정했다. 봉우리가 길어지면 보드 높이는 동적으로
  확장한다. 전경 잔디는 하단 `120px` 띠만 유지하고, 식물별 추가 그림자는 초록
  바처럼 보이므로 렌더링하지 않는다.
- 한 식물의 봉우리가 많아져 기본 높이를 넘으면 `skyExtension`만큼 하늘을 위쪽에
  추가한다. 잔디 경계, 잔디 덩어리, 바닥 그림자, 화분 기준선은 같은 값만큼 함께
  이동하고 자동 스크롤도 보정한다. 따라서 화면에서 땅과 화분의 상대 위치는
  유지되고 줄기만 위쪽 하늘 방향으로 길어진다.

### Git push

- 원격 저장소에 `git push`가 필요해 보이면 먼저 사용자에게 알린다.
- push는 사용자와 대화하여 범위, 브랜치, 커밋 상태를 확인한 뒤 수행한다.
- 사용자의 명시적인 요청이나 동의 없이 `git push`를 실행하지 않는다.
- 커밋이 필요한 경우에도 변경 파일과 커밋 메시지 범위를 먼저 확인한다.
