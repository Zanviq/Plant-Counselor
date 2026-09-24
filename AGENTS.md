# Plant Counselor - AGENTS.md

> 후속 작업자를 위한 저장소 핸드오프 문서
>
> 최종 점검: 2026-09-24 (공개용 정리: 호스팅 DB·외부 로그인 제거, Docker 전환)
>
> 이 문서는 현재 코드 상태를 기준으로 작성했다. 오래된 설계 문서와 실제 코드가
> 충돌하면 이 문서와 실제 코드를 우선한다.

---

## 0. 문서 로딩 정책

후속 작업자는 항상 이 `AGENTS.md`를 먼저 읽는다. 이후 작업 범위에 따라 아래 문서를
`@`로 추가 로드한다. 중복 설명을 줄이기 위해 세부 시나리오와 설계 배경은 문서로
넘기지만, 보안 경계와 현재 구현의 함정은 이 파일을 우선한다.

- 프로젝트 시작, 실행, 환경변수 확인: `@README.md`
- 문서 지형 확인: `@docs/README.md`
- 수동 회귀 시나리오가 필요한 기능 검증: `@docs/DEMO_GUIDE.md`
- 제품 메타포나 초기 기획 의도 확인: `@docs/구체화.md`
  - 단, 이 문서는 오래된 로컬 앱/Seed/회원가입 설명을 일부 포함할 수 있으므로 실제
    구현 판단에는 코드와 이 `AGENTS.md`를 우선한다.
- ReAct 오케스트레이터 설계 배경 확인:
  `@docs/superpowers/specs/2026-05-24-multi-step-orchestrator-design.md`
- `frontend/` 아래 파일 수정: `@frontend/AGENTS.md`

`docs/MVP/`와 `docs/superpowers/plans/`는 역사 자료다. 현재 코드 판단 근거로 먼저
읽지 않는다. 이 저장소에 없는 `docs/Web/`, `docs/DEPLOYMENT_GUIDE.md`,
`docs/해야할일.md`를 전제로 작업하지 않는다.

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

`seed` 상태는 폐지됐다. `buds.status` 기본값은 `bud`다(Alembic `0001_initial_schema`).
일부 코드의 `seed` 참조는 과거 데이터 복원을 위한 읽기 호환과 집계 방어 코드일 뿐이며,
신규 기능에서 공식 상태로 다시 노출하지 않는다.

---

## 2. 현재 구현 상태

웹 MVP의 핵심 기능은 구현되어 있다.

| 영역 | 현재 상태 |
| --- | --- |
| 랜딩 페이지, 아이디/비밀번호 로그인·회원가입 | 구현 완료 |
| 자체 인증 (bcrypt + httpOnly 쿠키 세션) | 구현 완료 |
| Docker Compose 실행 + 데모 seed | 구현 완료 |
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
| 주요 사용자 화면 반응형 레이아웃 | 구현 완료 |
| 테마 | light / dark / system |
| 설정 | 계정 / AI 키 / 정원 규칙 / 테마 / 정보 |
| 관리자 패널 | 구현 완료 |
| 관리자 데이터 백업과 복원 | 구현 완료 |
| 관리자 타임 트래블 | 구현 완료 |

### 문서 불일치 주의

일부 역사 자료는 최신 코드보다 오래됐다.

- `docs/MVP/`는 2026-05-27 시점 초기 웹 MVP 스냅샷이다. 제거된 SQLAlchemy 계층,
  쿠키 기반 인증, 강조색 선택, 15개 스킬 설명이 남아 있다.
- `docs/superpowers/plans/`는 당시 구현 계획이므로 완료 후 달라진 코드를 판단하는
  기준으로 사용하지 않는다.
- `docs/구체화.md`는 제품 개념 참고용이다. 현재 코드는 자체 PostgreSQL, 아이디/비밀번호
  인증, `bud` 시작 상태, 웹 앱 구조를 기준으로 하므로 해당 문서의 오래된 구현 설명을 그대로
  따르지 않는다.
- 현재 웹 MVP용 자동 테스트 묶음은 없다. `scripts/test_ui_infra.py`는 이전 Pygame
  프로토타입용이며 현재 웹 앱 회귀 테스트로 사용하면 안 된다.

최신 동작을 파악할 때는 아래 순서를 따른다.

1. 실제 코드
2. 이 문서
3. `@README.md`와 `@docs/README.md`
4. 검증이 필요하면 `@docs/DEMO_GUIDE.md`
5. 제품 의도나 설계 배경이 필요할 때만 관련 `@docs/...` 문서

---

## 3. 기술 스택

| 계층 | 기술 |
| --- | --- |
| Frontend | Next.js 16.2.6, React 19.2.4, TypeScript, Tailwind CSS v4 |
| Frontend state | Zustand, TanStack Query v5 |
| Backend | FastAPI, Pydantic v2, APScheduler |
| Backend environment | Docker 이미지는 `requirements.txt`, 로컬은 pip 또는 Poetry |
| Database access | psycopg 3 + `psycopg_pool` (`app/db/pg.py` 쿼리 빌더) |
| Database | PostgreSQL 16 (docker compose `db` 서비스) |
| Migrations | Alembic (plain SQL revision) |
| Authentication | 아이디/비밀번호, bcrypt 해시, HS256 JWT를 담은 httpOnly 쿠키 |
| LLM | Google Gemini via `google-genai` |
| LLM API key | 사용자가 브라우저에 입력, 요청마다 `X-Gemini-Api-Key` 헤더로 전달 |
| IDs | ULID |

### 중요한 결정

- DB 연결은 `backend/app/db/pg.py`가 담당한다. 기존 코드의
  `db.table("x").select().eq().execute()` 체인을 psycopg 파라미터 바인딩 SQL로
  컴파일하는 호환 계층이며, 결과 행은 JSON 호환 dict(날짜는 ISO 문자열)로 돌려준다.
- SQLAlchemy는 Alembic 엔진으로만 쓴다. ORM 모델을 추가하지 않는다.
- DB에는 RLS가 없다. 사용자별 데이터 격리는 repository 쿼리의 `user_id` 필터로 강제한다.
- 세션은 백엔드가 발급하는 httpOnly 쿠키(`pc_session`)다. 프론트 JS는 토큰을 다루지 않고
  모든 요청을 `credentials: "include"`로 보낸다.
- 사이드바 프로필은 닉네임 첫 글자를 표시한다(외부 아바타 없음).
- Gemini API 키는 서버 `.env`나 DB에 두지 않는다. 브라우저 localStorage
  (`pc-gemini-api-key`)에만 저장하고 채팅 요청 헤더로 전달한다. 서버는 로그·DB에 남기지 않는다.
- Next.js 서버 측 proxy에서는 로그인 여부를 판단하지 않는다.
- AI 채팅 응답은 동기 SSE 제너레이터로 스트리밍한다.

---

## 4. 저장소 구조

```text
Plant-Counselor/
├── AGENTS.md
├── CLAUDE.md      # @AGENTS.md 포인터
├── README.md
├── README.ko.md
├── docker-compose.yml
├── .env.example
├── image/            # README 스크린샷
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
│   │   ├── security.py
│   │   ├── db/pg.py
│   │   ├── db/seed.py
│   │   └── scheduler/jobs.py
│   ├── alembic/versions/0001_initial_schema.py
│   ├── alembic.ini
│   ├── Dockerfile
│   ├── docker-entrypoint.sh
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
│   └── capture-screenshots/  # README 스크린샷 Playwright 스크립트
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
  -> app/db/pg.py (psycopg)
  -> PostgreSQL 16
```

| 계층 | 책임 | 예시 |
| --- | --- | --- |
| Router | 인증, HTTP 입출력, Pydantic 검증 | `routers/buds.py` |
| Service | 도메인 로직, 여러 repository 조합 | `services/bud_service.py` |
| Repository | DB CRUD, `user_id` 격리 | `repositories/bud_repo.py` |
| Schema | API 입출력 타입 | `schemas/bud.py` |

### 주요 진입점

- FastAPI 앱: `backend/app/main.py`
- 로컬 서버: `backend/run.py`
- 인증 의존성: `backend/app/deps.py`
- DB 클라이언트: `backend/app/db/pg.py`
- 비밀번호·세션 쿠키: `backend/app/security.py`
- 인증 API: `backend/app/routers/auth.py`
- 데모 seed: `backend/app/db/seed.py`
- 런타임 설정: `backend/app/runtime_settings.py`
- 스케줄러: `backend/app/scheduler/jobs.py`

### 인증

- API: `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- 비밀번호는 bcrypt로 해시해 `users.password_hash`에 저장한다. API 응답에 이 컬럼이
  나가지 않도록 `user_repo.PUBLIC_COLUMNS`와 admin 라우터의 `_public_user()`를 유지한다.
- 로그인 성공 시 HS256 JWT(`sub`=user id)를 httpOnly·SameSite=Lax 쿠키로 내려준다.
  서명 키 `SESSION_SECRET`, 만료 `SESSION_TTL_HOURS`(기본 7일), HTTPS면 `COOKIE_SECURE=true`.
- `require_user()`는 쿠키를 검증하고 `users` 행(비밀번호 제외)을 반환한다.
- 과거 RLS 정책(`calendar_events_owner`, `ai_logs`)은 코드 검사로 옮겼고 목록은
  `deps.py`와 Alembic `0001_initial_schema` docstring에 주석으로 남겼다.

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
CORS 메서드는 `GET`, `POST`, `PATCH`, `PUT`, `DELETE`, 헤더는 `Content-Type`,
`X-Gemini-Api-Key`만 허용한다. 새 API가 다른 메서드나 요청 헤더를 요구하면 사용처를
확인한 뒤 명시적으로 추가한다.

### DB 접근 규칙

- 새 CRUD는 기존 repository 패턴을 사용한다.
- 일반 테이블은 `db.table("...")` 쿼리 빌더를 사용한다. 빌더에 없는 연산이 필요하면
  `pg.py`에 파라미터 바인딩 방식으로 추가한다.
- 쿼리에는 필요한 경우 반드시 `user_id` 필터를 넣는다.
- 스키마 변경은 `backend/alembic/versions/`에 새 revision으로 추가한다. 컨테이너 시작 시
  `alembic upgrade head`가 자동 실행된다.
- `calendar_events`는 예외적으로 raw SQL(`db.rpc("exec_admin_query", ...)`)을 쓴다.
  과거 호스팅 DB의 스키마 캐시 문제 때문이었고, 동작 보존을 위해 유지 중이다.

### `calendar_events` 예외

`backend/app/repositories/calendar_event_repo.py`는 SQL 문자열을
`pg.Client.exec_admin_query`로 전달한다.

- 값은 `_lit()`을 통해 작은따옴표를 escape한다.
- 컬럼명과 테이블명은 하드코딩한다.
- 사용자 입력을 identifier 위치에 직접 보간하지 않는다.
- 독립 일정 수정에서 관련 식물 연결을 해제할 때는 `plant_id = NULL` 업데이트를
  허용한다. router의 `model_fields_set` 확인과 repository의 `plant_id` 예외 처리를
  함께 유지한다.
- 쿼리 빌더 방식으로 바꿔도 되지만 `plant_id = NULL` 해제 규칙을 함께 옮긴다.

---

## 6. AI 시스템

### 요청 흐름

```text
POST /api/v1/chat/message
  -> require_user
  -> X-Gemini-Api-Key 헤더 확인 (없으면 api_key_required error 이벤트 후 종료)
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

스킬은 LLM 인자가 완벽하다고 가정하지 않는다. 날짜는 `YYYY-MM-DDTHH:MM...`처럼
들어와도 필요한 경우 앞 10자리 날짜로 정규화하고, 한국어 색상명처럼 사용자 자연어가
들어올 수 있는 필드는 백엔드에서 팔레트 ID로 정규화한다. 서비스 계층의 `ValueError`
도메인 예외는 `SkillRegistry`의 generic `internal`로 새지 않게 각 스킬에서 잡아
사용자에게 이해 가능한 `SkillResult`로 반환한다.

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
| `/login` | 아이디/비밀번호 로그인과 회원가입 |
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

- 인증 API: `frontend/lib/api/auth.ts`, 화면: `frontend/app/(auth)/login/page.tsx`
- 일반 앱 가드: `frontend/app/(app)/layout.tsx`
- 관리자 가드: `frontend/app/admin/layout.tsx`
- Next.js 16 pass-through proxy: `frontend/proxy.ts`
- Gemini 키 저장: `frontend/lib/geminiKey.ts`, 입력 UI: `frontend/components/ai/GeminiKeyForm.tsx`
  (설정 → AI, 채팅 패널에서 키가 없을 때 표시)

세션 쿠키는 API origin(FastAPI)이 발급하므로 Next 서버(`proxy.ts`)는 검증할 수 없다.
가드는 클라이언트의 `/auth/me` 호출로 하고, 백엔드가 모든 API에서 다시 검사한다.
`authStore`는 프로필 캐시와 `authed` 플래그만 가진다. 페이지 쿼리는 `enabled: authed`로
세션 확인 뒤 실행한다.
관리자 계정으로 로그인해도 일반 앱 화면(`/home`, `/plants`, `/calendar` 등)에서
`/admin`으로 자동 이동시키지 않는다. 관리자 화면 접근 허용과 일반 사용자 차단은
`frontend/app/admin/layout.tsx`의 관리자 가드가 담당한다.

### 반응형 레이아웃 기준

전역 반응형 기준은 `frontend/app/globals.css`의 다음 클래스와 CSS 변수에 둔다.

```text
--sidebar-w
--page-pad-x
--page-pad-y
--page-pad-bottom
--page-max
.app-main
.app-page
.app-page-narrow
.app-page-wide
.app-page-calendar
.responsive-grid-2 / 3 / 4
.responsive-card-grid
.calendar-layout
.calendar-month-scroll / .calendar-month-inner / .calendar-month-grid
.calendar-summary-grid
.settings-layout
.history-shell
.history-layout
.chat-panel
```

사용자용 주요 페이지(`/home`, `/plants` 리스트, `/plants/{id}`, `/calendar`,
`/history`, `/settings`)는 고정 `maxWidth`와 고정 컬럼 수를 직접 반복하지 말고
위 클래스를 우선 사용한다. 데스크톱에서는 `app-page-wide`로 큰 화면 폭을 더 쓰고,
달력처럼 높이에 비해 폭만 늘어나면 어색한 화면은 `app-page-calendar`처럼 화면별
최대 폭을 따로 둔다.
작은 화면에서는 `auto-fit`/media query로 카드와 2단 레이아웃이 한 컬럼으로 접힌다.
채팅 패널은 데스크톱에서만 본문을 밀고, 좁은 화면에서는 오버레이처럼 떠서 본문 폭을
더 줄이지 않는다.
월간 캘린더는 좁은 화면에서 7열 구조를 유지하되 일정 제목을 색상 막대로 축약한다.
이벤트 제목을 그대로 노출하려고 셀 폭을 강제로 늘리거나 body 가로 스크롤을 만들지
않는다. 관련 클래스는 `calendar-month-*`와 `calendar-event-pill`을 우선 수정한다.
월간 캘린더 카드 높이는 일정 개수에 따라 늘어날 수 있어야 하므로 `calendar-layout`에
viewport 기준 고정 행 높이를 다시 넣거나 캘린더 카드에 `overflow: hidden`을 걸어
마지막 주차를 자르지 않는다.

앞으로 새 프론트 UI를 만들 때는 가변 UI를 기본 전제로 설계한다. 특정 해상도에서만
맞는 정적 배치보다 `clamp()`, `min()`, `max()`, `auto-fit`, `minmax()`, `flex-wrap`,
내부 스크롤 영역, CSS 변수 기반 spacing을 우선 사용한다. 큰 화면에서는 빈 공간을
의미 있게 활용하고, 작은 화면에서는 가로 스크롤이나 요소 겹침 없이 한 컬럼 또는
스크롤 가능한 내부 영역으로 자연스럽게 접히게 만든다.

새 화면을 추가할 때 inline style에 `maxWidth: 960/1200`, `gridTemplateColumns:
"repeat(3|4, 1fr)"`, 고정 drawer 폭을 직접 박기 전에 전역 클래스로 해결 가능한지
먼저 확인한다. 정원 캔버스처럼 자체 스크롤과 확대/축소가 있는 화면은 예외로 둘 수
있지만, 헤더 HUD와 drawer는 `--sidebar-w`와 viewport 폭을 고려해야 한다.

---

## 8. 캘린더와 시간 처리

캘린더에는 두 종류의 항목이 함께 표시된다.

| 종류 | 저장 위치 | 특징 |
| --- | --- | --- |
| 식물 일정 | `buds.deadline` | 진행률과 생애주기 있음 |
| 일반 일정 | `calendar_events` | 진행률 없음, 단순 약속과 예약. 날짜, 선택 시간, 하루 종일 여부 저장 |

일반 일정은 `color`에 `olive`, `blue`, `yellow`, `red`, `pink`, `purple` 중 하나를
저장한다. 기본값은 기존 강조색과 같은 `olive`다. 프론트 일정 modal과 AI 일정 스킬은
같은 팔레트 ID를 사용하며 임의 CSS 색상 문자열은 저장하지 않는다.
AI 스킬 입력은 사용자 자연어 색상도 허용한다. `backend/app/calendar_colors.py`의
`normalize_calendar_event_color()`가 초록/녹색/연두/카키/green을 `olive`,
파랑/blue를 `blue`, 노랑/yellow/gold를 `yellow`, 빨강/red를 `red`,
분홍/핑크/pink를 `pink`, 보라/purple/violet을 `purple`로 정규화한다. 새 색상을
추가할 때는 프론트 팔레트, `CalendarEventColor`, alias, 문서, AI 스킬 설명을 함께 맞춘다.

일반 일정은 `event_date date`, `event_time time`, `end_date date`, `end_time time`,
`all_day boolean`, `repeat_rule text`로 시간 정보를 표현한다. `event_date`는 시작
날짜다. `all_day=true`이면 시작/종료 시간은 `NULL`이어야 하고, `all_day=false`이면
시작/종료 시간이 모두 필요하다. 반복 규칙은 `none`, `daily`, `weekly`, `monthly`,
`yearly` 중 하나다. 기존 date-only 일정은 migration 005에서 하루 종일 일정으로 유지했고,
migration 006에서 종료 날짜와 반복 규칙을 추가했다. 프론트 일정 modal은 Apple Calendar처럼
하루 종일 토글을 켜면 시간 입력을 숨기고, 시작/종료 날짜와 반복 선택을 함께 저장한다.
AI의 `create_calendar_event`와 `update_calendar_event` 스킬은 LLM 인자가 조금
불완전해도 사용자 의도에 맞게 보정한다. `time` 또는 `end_time`이 있으면 `all_day`를
생략해도 시간 일정으로 간주하고, 종료 시간이 없으면 시작 시간 1시간 뒤를 기본값으로
채운다. 23시 이후로 넘어가면 `end_date`도 다음 날로 보정한다. 이 규칙은
`backend/app/ai/calendar_event_args.py`에서 공통 처리하며, 실행 전 AI 미리보기의
충돌 감지도 같은 보정 함수를 사용해야 한다.

`GET /api/v1/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD`는 두 종류를 병합하고
`source: "bud" | "event"`로 구분한다.

### 앱 시간

`backend/app/runtime_settings.py`의 `rs.now()`와 `rs.today()`를 사용한다.

- 기본 앱 타임존: UTC+9, KST
- 타임 트래블: `time_offset_seconds`
- 스케줄러와 AI 프롬프트는 가상 시간을 반영한다.
- 백업 파일명과 로그 파일명처럼 외부 artifact 생성 시간은 실제 시간을 사용한다.
- `rs.real_now()`와 `rs.now()`는 timezone-aware datetime을 반환해야 한다.
  ISO 문자열에 `+09:00` offset이 포함되어야 관리자 화면이나 클라이언트가 서버 시간을
  UTC로 오해하지 않는다.
- 관리자 컨트롤러의 타임 트래블 UI는 브라우저 로컬 시간이나 UTC formatter로 시간을
  재계산하지 말고 `/admin/controller/time`의 `real_now`, `virtual_now`를 KST로
  표시한다.

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

### Docker Compose (기본)

```bash
cp .env.example .env
docker compose up --build
```

- `db`(postgres:16-alpine, named volume `db-data`, healthcheck) → `backend`
  (`docker-entrypoint.sh`: `alembic upgrade head` → `python -m app.db.seed` → uvicorn)
  → `frontend`(Next standalone) 순서로 `condition: service_healthy`에 따라 뜬다.
- 데모 계정: `demo / demo1234`, `admin / admin1234`. seed는 `demo` 사용자가 없을 때만
  들어가며 날짜는 오늘 기준 상대값이다. DB 초기화는 `docker compose down -v`.
- 포트를 바꾸면 `.env`의 `CORS_ALLOW_ORIGIN`, `NEXT_PUBLIC_API_BASE`도 맞추고
  `--build`로 프론트를 다시 빌드한다(`NEXT_PUBLIC_*`는 빌드 시 번들에 들어간다).

### 백엔드 (Docker 없이)

```bash
cd backend
pip install -r requirements.txt   # 또는 poetry install
# PostgreSQL 16을 띄우고 DATABASE_URL, SESSION_SECRET을 환경변수 또는 backend/.env에 넣는다
alembic upgrade head
python -m app.db.seed
python run.py
```

`backend/pyproject.toml`은 Poetry의 `package-mode = false`를 사용한다. Docker 이미지는
`requirements.txt`로 설치하므로 의존성을 바꾸면 두 파일을 함께 수정한다.

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

### 환경변수

루트 `.env.example`이 기준이다. docker compose가 이를 백엔드/프론트로 나눠 전달한다.

```dotenv
POSTGRES_DB / POSTGRES_USER / POSTGRES_PASSWORD
SESSION_SECRET=...          # 세션 쿠키 서명 키 (필수)
COOKIE_SECURE=false         # HTTPS면 true
CORS_ALLOW_ORIGIN=http://localhost:3000
SEED_DEMO_DATA=true
BACKEND_PORT=8000 / FRONTEND_PORT=3000
NEXT_PUBLIC_API_BASE=http://localhost:8000/api/v1   # 빌드 시 번들에 포함
```

백엔드 단독 실행 시에는 `DATABASE_URL`(psycopg URL)을 직접 준다. AI 키는 환경변수가
아니다. 사용자가 설정 → AI에서 입력한다.

### 비밀값 주의

- `.env`, `backend/.env`, `frontend/.env.local`은 gitignore 대상이다. `.env.example`만 커밋한다.
- 실제 세션 secret, Gemini key를 문서, 로그, 커밋에 넣지 않는다.
- 백업 ZIP에는 `users.password_hash`가 포함된다. 관리자 외에 공유하지 않는다.
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

2026-09-24 기준 `npm run lint`는 기존 프론트엔드 코드에서 실패한다. 현재 기준선은
7 errors, 12 warnings이며 주요 오류는 effect 내부의 동기 `setState`, 선언 전
`sendText` 참조, JSX 내 escape되지 않은 따옴표다. 기능 변경 시 새 오류를 추가하지
말고, 관련 파일을 수정한다면 함께 정리한다.

### 백엔드 기본 검증

```bash
cd backend
python -m compileall app alembic
```

### 전체 스택과 스크린샷

```bash
docker compose down -v && docker compose up --build
```

README 스크린샷은 `scripts/capture-screenshots/capture.mjs`로 다시 만든다(파일 상단
주석에 실행법). AI 채팅 화면은 목 SSE 응답을 쓴다.

### 수동 회귀 확인

관련 변경 범위에 따라 `docs/DEMO_GUIDE.md`의 시나리오를 사용한다. 단 이 문서의 로그인·
환경변수 설명은 공개용 정리 이전 기준일 수 있다.

키 없이 가능한 확인: 식물·봉우리 생성은 AI 스킬 경유이므로, 채팅 없이 확인하려면
`POST /chat/message`에 `confirmed_actions`로 스킬을 직접 실행한다(LLM 호출 없음).

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
backend/alembic/versions/0001_initial_schema.py
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
backend/alembic/versions/0001_initial_schema.py
frontend/lib/api/stats.ts
frontend/app/(app)/calendar/page.tsx
```

### 인증을 수정할 때

다음 파일을 함께 확인한다.

```text
backend/app/deps.py
backend/app/security.py
backend/app/routers/auth.py
backend/app/repositories/user_repo.py
frontend/lib/api/auth.ts
frontend/lib/api/client.ts
frontend/app/(auth)/login/page.tsx
frontend/app/(app)/layout.tsx
frontend/app/admin/layout.tsx
frontend/proxy.ts
```

세션 토큰을 JS(localStorage)로 옮기지 않는다. httpOnly 쿠키 방식을 유지한다.

---

## 14. 알려진 개선 후보

현재 코드 기준으로 남아 있는 개선 후보:

- 시간 문자열 HH:MM 정규화
- 통계 차트
- 웹 MVP 자동화 테스트
- 오래된 MVP 문서 정리

기능 추가 전에 이미 구현된 API가 있는지 먼저 확인한다. 식물 이름/설명과 봉우리
제목/detail은 사용자 UI에서 직접 수정할 수 있으며 기존 `PATCH /plants/{id}`,
`PATCH /buds/{id}` API를 사용한다.

현재 캘린더는 날짜/시간/종료일/반복/색상 선택, 월간 뷰 일반 일정 드래그 이동,
연속된 다일 일반 일정의 막대형 표시, 시간대 충돌 경고, JSON/CSV/ICS 내보내기를
지원한다. 반복 일정은 발생일과 원본 시작일이 달라 월간 드래그 대상에서 제외하고
수정 모달에서 변경한다. 시간대가 겹쳐도 저장은 허용하되 REST 응답과 AI 미리보기/실행
결과의 `conflicts` 배열로 경고한다. AI 변경 스킬은 기본적으로 실행 전 미리보기 카드로
멈추고, 사용자가 실행을 눌러야 `confirmed_actions`로 실제 dispatch된다.

`/undo/last`는 최근 삭제/상태 변경을 되돌리는 in-process 스택이다. 서버 재시작 후
사라지는 즉시 복구 장치이며 감사 로그나 장기 이력 테이블이 아니다. 영구 되돌리기가
필요하면 별도 DB 테이블 설계를 먼저 한다.

---

## 15. 주의할 함정

- `frontend/proxy.ts`에 서버 측 로그인 redirect를 다시 넣지 않는다.
- `calendar_events`는 raw SQL 경로를 쓴다. 쿼리 빌더와 같은 방식이라고 가정하지 않는다.
- Gemini 키를 서버 `.env`, DB, 로그에 저장하는 코드를 추가하지 않는다.
- `users` 행을 그대로 API로 내보내지 않는다(`password_hash`).
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
| `@CLAUDE.md` | `@AGENTS.md` 포인터. 별도 내용은 유지하지 않는다. |
| `@README.md` | 로컬 실행과 배포 시작점 |
| `@docs/README.md` | 현재 존재하는 문서와 역사 자료 구분 |
| `@docs/DEMO_GUIDE.md` | 기능별 수동 테스트 시나리오 |
| `@docs/구체화.md` | 제품 메타포와 초기 UX 의도. 구현 세부는 오래될 수 있다. |
| `@docs/superpowers/specs/2026-05-24-multi-step-orchestrator-design.md` | ReAct 루프 설계 배경 |
| `@frontend/AGENTS.md` | Next.js 16 작업 시 추가 지침 |

---

## 17. 작업 시작 전 빠른 점검

후속 작업자는 코드 수정 전에 다음을 확인한다.

```bash
git status --short --branch
rg --files -g 'AGENTS.md' -g 'CLAUDE.md'
rg --files docs
```

그 다음 작업 범위에 맞는 파일과 관련 `@docs/...` 문서를 읽는다. 기존 사용자 변경이 있으면
되돌리지 말고 함께 반영한다. 기능 구현 후에는 변경 범위에 맞는 lint, build, compile,
수동 회귀 확인을 수행한다.

---

## 18. 상세 맥락 문서

과거 세션 맥락, 제품 메타포, Figma/프론트 동기화 규칙, 정원 픽셀아트 세부 규칙은
`@docs/구체화.md`에 통합했다. 다음 작업은 해당 문서를 추가로 읽는다.

- Figma와 프론트 차이를 줄이는 UI 작업
- 랜딩 preview, 정원, 캘린더, 대화 기록 화면 수정
- 식물/봉우리 메타포나 픽셀아트 규칙 변경
- 과거 설계와 현재 구현의 차이를 판단해야 하는 작업

---

## 19. 협업과 Git 운영 규칙

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
- Figma, 랜딩 preview, 캘린더, 대화 기록, 정원 픽셀아트, 식물 메타포를 수정할 때는
  먼저 `@docs/구체화.md`의 현재 구현 기준과 Figma 동기화 규칙을 읽는다.
- UI 수정 전 대상 Figma 화면의 URL 또는 파일 키와 노드 ID를 확보하고, Figma MCP의
  디자인 컨텍스트와 스크린샷을 읽어 현재 프론트 화면과 비교한다.
- 화면 단위 수정 후 관련 라우트를 Codex 인앱 브라우저에서 다시 확인한다.
- 기준 Figma 파일은
  `https://www.figma.com/design/1zp2zhoM4lTb56iIJfpI1m/Plant-Counselor?node-id=4-23`이다.

### Git push

- 원격 저장소에 `git push`가 필요해 보이면 먼저 사용자에게 알린다.
- push는 사용자와 대화하여 범위, 브랜치, 커밋 상태를 확인한 뒤 수행한다.
- 사용자의 명시적인 요청이나 동의 없이 `git push`를 실행하지 않는다.
- 커밋이 필요한 경우에도 변경 파일과 커밋 메시지 범위를 먼저 확인한다.
