# Plant Counselor — CLAUDE.md

> **다음 Claude 세션을 위한 핸드오프 문서**  
> 최종 업데이트: 2026-05-30 (세션 12)  
> 작성자: confidencecat (jaemi)

---

## 1. 프로젝트 한 줄 요약

**고민과 일정을 식물 생애주기에 비유해 AI 정원사와 함께 가꾸는 웹 서비스.**

- 사용자가 자연어로 말하면 AI(Gemini 2.5 Flash)가 **식물**(분야/카테고리)과 **봉우리**(구체적 고민/일정)를 자동 생성
- 봉우리는 씨앗 → 새싹 → 꽃 → 열매 → 수확 / 방치 시 시들음 → 썩음 생애주기
- 픽셀아트 정원에서 모든 식물과 봉우리를 시각적으로 확인

---

## 2. 현재 완성 상태

**MVP 완성 상태.** 모든 핵심 기능이 구현·테스트됨.

### 구현된 기능 요약

| 영역 | 상태 |
|------|------|
| 랜딩 페이지 (`/`) + 로그인 흐름 | ✅ 완성 (세션 9에서 버그 수정 + 재디자인) |
| 인증 (Supabase Auth + Google OAuth) | ✅ 완성 (세션 7에서 마이그레이션) |
| DB (Supabase PostgreSQL + RLS) | ✅ 완성 (세션 7에서 마이그레이션) |
| 식물 CRUD | ✅ 완성 |
| 봉우리 CRUD + 7상태 생애주기 | ✅ 완성 |
| AI 채팅 (ReAct, 16 스킬, SSE 스트리밍) | ✅ 완성 |
| 4가지 채팅 스코프 (global/plant/bud/calendar) | ✅ 완성 |
| 대화 스코프 변경 제안 배너 | ✅ 완성 (세션 7) |
| 캘린더 (이벤트 표시, 식물명/시간 포함) | ✅ 완성 |
| 캘린더 전용 AI 채팅 | ✅ 완성 |
| 픽셀아트 정원 (스프라이트, 슬롯, 캐러셀) | ✅ 완성 |
| 화살표 키 네비게이션 (딜레이 없음) | ✅ 완성 |
| 알림 (시들/썩음/마감 임박) | ✅ 완성 |
| 테마 (light/dark/system + 4종 강조색) | ✅ 완성 |
| 설정 (5탭, API 키 암호화) | ✅ 완성 |
| 10분 주기 자동 전이 (APScheduler) | ✅ 완성 |
| requirements.txt + README (venv 설명) | ✅ 완성 |
| 대화 기록 브라우저 (/history) | ✅ 완성 |
| ChatPanel 드래그 리사이즈 | ✅ 완성 |
| BudDetailDrawer + ChatPanel 공존 | ✅ 완성 |
| 페이지 네비게이션 딜레이 제거 (캐시 최적화) | ✅ 완성 |
| AI 봉우리 탐색 버그 수정 (list_buds 강제) | ✅ 완성 |
| **관리자 패널** (`/admin/*`, 역할 시스템) | ✅ 완성 (세션 11) |
| **컨트롤러** (`/admin/controller`, 런타임 설정) | ✅ 완성 (세션 11) |
| **데이터 관리** (`/admin/data`, 개별 삭제) | ✅ 완성 (세션 11) |
| **타임 트래블** (데모용 서버 시간 이동) | ✅ 완성 (세션 11) |

---

## 3. 기술 스택

| 계층 | 기술 |
|------|------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS v4, Zustand, TanStack Query v5 |
| **Backend** | FastAPI, **supabase-py** (PostgREST HTTP), Pydantic v2, APScheduler |
| **LLM** | Google Gemini 2.5 Flash (`google-genai` SDK) |
| **DB** | Supabase PostgreSQL (psycopg2 제거 → **supabase-py HTTP**) + Row Level Security |
| **Auth** | Supabase Auth (Google OAuth) + **ES256 JWKS** 검증 (HS256 fallback) + Fernet (API 키 암호화) |
| **BaaS** | Supabase (프로젝트 ID: `mnqwrofidwotcsvsymnd`, region: ap-northeast-2) |
| **ID** | ULID (python-ulid) |

---

## 4. 프로젝트 구조 (핵심 파일만)

```
plant-counselor/
├── backend/
│   ├── app/
│   │   ├── ai/
│   │   │   ├── chat_orchestrator.py  ← ReAct 루프 (MAX_STEPS runtime_settings에서 읽음)
│   │   │   ├── llm_client.py         ← Gemini API 래퍼 (DEFAULT_MODEL 런타임 교체 가능)
│   │   │   ├── prompt_builder.py     ← 시스템 프롬프트 + rs.today() (타임 트래블 연동)
│   │   │   ├── skill_registry.py     ← 스킬 등록 + catalog
│   │   │   └── skills/               ← 16개 스킬 각 파일
│   │   ├── db/
│   │   │   ├── models/               ← SQLAlchemy ORM 모델 (타입 정의용, DB 접근은 supabase-py)
│   │   │   └── supa.py               ← Supabase PostgREST 클라이언트 싱글톤
│   │   ├── routers/
│   │   │   ├── admin.py              ← 관리자 API (require_admin 보호)
│   │   │   ├── chat.py               ← POST /chat/message (SSE)
│   │   │   └── stats.py              ← /calendar
│   │   ├── services/
│   │   │   ├── transition_service.py ← 시들/썩음 자동 전이 (rs.now() 타임 트래블)
│   │   │   └── user_service.py       ← 회원탈퇴: 전체 데이터 cascade 삭제
│   │   ├── runtime_settings.py       ← 런타임 변수 저장소 (타임 오프셋, 모델, 스텝 등)
│   │   ├── config.py                 ← pydantic-settings
│   │   └── main.py                   ← FastAPI app
│   ├── run.py                        ← uvicorn (reload_excludes: *.json, logs/**)
│   └── .env.example                  ← 환경변수 템플릿
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx                ← 루트 레이아웃 (테마 inline script)
│   │   ├── providers.tsx             ← QueryClient (staleTime:30s, refetchOnFocus:true)
│   │   ├── page.tsx                  ← 랜딩 페이지 "/"
│   │   ├── admin/                    ← 관리자 패널 (role=admin만 접근)
│   │   │   ├── layout.tsx            ← 관리자 사이드바 + 접근 제어
│   │   │   ├── page.tsx              ← 대시보드 (통계 + 최근 AI 세션)
│   │   │   ├── users/page.tsx        ← 사용자 관리 + 역할 변경
│   │   │   ├── users/[id]/page.tsx   ← 사용자 상세
│   │   │   ├── logs/page.tsx         ← AI 로그 브라우저
│   │   │   ├── notifications/page.tsx← 알림 발송
│   │   │   ├── data/page.tsx         ← 데이터 관리 (개별 삭제)
│   │   │   └── controller/page.tsx   ← 런타임 설정 + SQL + 타임 트래블
│   │   ├── (app)/home/page.tsx       ← 대시보드 "/home"
│   │   ├── (app)/plants/page.tsx     ← 정원 뷰
│   │   ├── (app)/calendar/page.tsx   ← 캘린더
│   │   └── (app)/settings/page.tsx   ← 5탭 설정
│   ├── lib/
│   │   ├── api/admin.ts              ← 관리자 API 클라이언트 (전체 타입 포함)
│   │   └── api/client.ts             ← fetch wrapper (네트워크 에러 try-catch 포함)
│   └── public/sprites/               ← 픽셀아트 PNG 파일들
│
├── CLAUDE.md                         ← 이 파일
└── README.md                         ← 빠른 시작 가이드
```

---

## 5. 로컬 개발 환경 실행

```bash
# 백엔드
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1   # Windows
# source .venv/bin/activate  # Mac/Linux
pip install -e .              # psycopg2-binary, fastapi 등 전체 설치
cp .env.example .env
# .env 편집: 아래 필수 환경변수 참고
python run.py                 # → http://localhost:8000
# API 문서: http://localhost:8000/docs

# 프론트엔드 (새 터미널)
cd frontend
pnpm install
pnpm dev                      # → http://localhost:3000
```

### 필수 환경변수 (backend/.env)

```dotenv
# Supabase PostgreSQL 연결 (pooler 사용 — psycopg2 fallback이지만 실제로는 supabase-py HTTP 사용)
DATABASE_URL=postgresql+psycopg2://postgres.PROJECT_REF:PASSWORD@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres

# Supabase JWT Legacy Secret (Dashboard → Settings → API → JWT Secret → Legacy)
SUPABASE_JWT_SECRET=여기에-supabase-legacy-jwt-secret

# Supabase 서비스 롤 키 (JWT secret에서 자동 생성 — 직접 입력 또는 아래 스크립트로 생성)
# python -c "from jose import jwt; import time; print(jwt.encode({'iss':'supabase','ref':'PROJECT_REF','role':'service_role','iat':...,'exp':...}, JWT_SECRET, algorithm='HS256'))"
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# Google AI Studio API 키
LLM_API_KEY=AIzaSy...

# API 키 암호화용 (32자 이상 랜덤 문자열)
KEY_ENCRYPTION_SECRET=여기에-32자-이상-랜덤-문자열

CORS_ALLOW_ORIGIN=http://localhost:3000
```

> **⚠ DB 연결 주의**: psycopg2 직접 연결은 IPv6 전용 / pooler ENOTFOUND 문제로 작동하지 않습니다.
> 실제 DB 접근은 `supabase-py` PostgREST HTTP로 이루어집니다 (`SUPABASE_SERVICE_ROLE_KEY` 필수).

### Google OAuth 설정 (Supabase Dashboard에서 수동 설정 필요)

1. Supabase Dashboard → Authentication → Providers → Google → Enable
2. Google Cloud Console에서 OAuth 2.0 클라이언트 ID/Secret 발급
3. Authorized redirect URI 추가: `https://mnqwrofidwotcsvsymnd.supabase.co/auth/v1/callback`
4. Client ID/Secret을 Supabase Dashboard에 입력

---

## 6. 핵심 설계 패턴 & 컨벤션

### 6.1 AI 시스템

```
사용자 발화
  → POST /chat/message {text, scope, scope_id, current_screen}
  → ChatOrchestrator.run() — 동기 SSE 제너레이터
  → PromptBuilder.build_system() — 정원 현황 + 행동 규칙 + 스코프 컨텍스트
  → ReAct 루프 (MAX_STEPS=10)
       LLM → tool_use? → registry.dispatch() → working_history 업데이트 → 반복
       텍스트 응답 → token 이벤트 스트리밍
  → SSE: start → (tool_call → tool_result)* → token* → done
```

- **질문 금지**: AI는 확인 없이 의도를 추론·즉시 실행
- **일정 자동 분류**: "밥먹기"→일상, "면접"→취업, "오늘"→ISO 날짜
- **스킬 등록 순서**: `think` 먼저 → LLM이 복잡 작업 시 자연스럽게 선택
- **스코프 불일치 감지**: 식물 스코프에서 다른 식물 요청 시 작업 실행 후 `suggest_scope_change` 호출

### 6.2 프론트엔드 상태 관리

```typescript
// 서버 상태: TanStack Query
useQuery({ queryKey: ["plants", {}], queryFn: listPlants })

// 스킬 실행 후 자동 무효화
invalidateQueries({ queryKey: ["plants"] })  // onDone에서 SKILL_INVALIDATIONS 매핑

// 전역 상태: Zustand
useChatStore()    // open, scope, openWith()
useAuthStore()    // user, token, setSession()
useThemeStore()   // mode, accent, setMode()
```

### 6.3 채팅 스코프

```typescript
interface ChatScope {
  kind: "global" | "plant" | "bud" | "calendar";
  id?: string;  // plant_id 또는 bud_id
}

// 열기
openWith({ kind: "calendar" })          // 캘린더 AI
openWith({ kind: "plant", id: plant.id })  // 식물 상담
openWith()                               // 전역 (기본)
```

- `kind === "calendar"` → `current_screen="캘린더"` → 프롬프트에 캘린더 규칙 활성화

### 6.4 React 상태 + DOM 사이드이펙트 분리 원칙

```typescript
// ❌ 잘못된 패턴 (이미 수정됨)
setSelectedIdx(prev => {
  const next = ...;
  setTimeout(() => el.scrollIntoView(...), 50);  // stale closure + 딜레이
  return next;
});

// ✅ 올바른 패턴
const navigate = useCallback((dir) => {
  setSelectedIdx(prev => Math.max(0, Math.min(max, prev + dir)));
}, [max]);

useEffect(() => {  // React 재렌더 완료 후 실행 → setTimeout 불필요
  el?.scrollIntoView({ behavior: "smooth", ... });
}, [selectedIdx]);
```

### 6.5 캘린더 이벤트 응답 형식

```python
# GET /api/v1/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
{
  "ok": true,
  "data": {
    "events": {
      "2026-05-27": [
        {
          "id": "01KSAZ...",
          "title": "도호랑 밥먹기",
          "status": "seed",
          "type": "schedule",
          "detail": "오후 1시, 도호와 함께",  // AI가 시간 정보를 여기에 저장
          "plant_name": "일상",
          "plant_id": "01KSAR..."
        }
      ]
    }
  }
}
```

### 6.6 디자인 팔레트

| CSS 변수 | Light | Dark |
|----------|-------|------|
| `--bg` | `#F5F2EB` (크림) | `#1A1D16` |
| `--bg-sidebar` | `#3D4A30` (다크 올리브) | `#2A3520` |
| `--fg` | `#2A2A2A` | `#E8E4DB` |
| `--accent` | `#5C6B3F` (올리브) | `#8BA05A` |

---

## 7. 중요한 기술 결정들

| 결정 | 이유 | 파일 |
|------|------|------|
| `google-genai` SDK (Gemini) | pyproject.toml에 anthropic 잘못 기재되어 있었음 → 수정 완료 | backend/pyproject.toml |
| 동기 SSE 제너레이터 | SQLAlchemy 동기 세션과 자연스럽게 결합 | chat_orchestrator.py |
| Anthropic IR → Gemini 변환 | 향후 Claude 전환 시 llm_client.py만 교체 | llm_client.py |
| detail 필드에 시간 저장 | DB 스키마 변경 없이 MVP에서 시간 정보 표현 | bud 모델 |
| setTimeout 제거 | state update와 DOM effect를 useEffect로 분리 | plants/page.tsx |
| ULID PK | URL-safe, 정렬 가능, UUID보다 디버깅 쉬움 | 모든 모델 |
| Supabase Auth (Google OAuth) | 자체 인증 구현 제거, 소셜 로그인 UX 개선 | deps.py, login/page.tsx |
| python-jose 로컬 JWT 검증 | 매 요청마다 Supabase API 호출 없이 검증 (성능) | deps.py |
| `user_id = text` 타입 | SQLAlchemy `String` 유지, PG UUID FK 없이 RLS와 호환 | 모든 모델 |
| DB 트리거 + fallback | `handle_new_auth_user()` 트리거로 자동 프로필 생성, 백엔드 fallback 포함 | deps.py |
| Supabase `onAuthStateChange` | 마운트 시 즉시 세션 로드 + 자동 갱신 (httpOnly 쿠키 불필요) | layout.tsx |
| 스코프 변경 제안 → 배너(non-blocking) | 모달 대신 배너로 UX 흐름 방해 최소화 | ChatPanel.tsx |
| `proxy.ts` 패스스루 (인증 로직 제거) | Next.js 16에서 middleware→proxy 이름 변경. 구 커스텀 인증(httpOnly cookie)용 로직이 Supabase 마이그레이션 후 남아 `/login`→`/` 리다이렉트 버그 유발. `@supabase/supabase-js`는 localStorage 사용 → 서버에서 쿠키 체크 불가 → 클라이언트 가드로만 처리 | frontend/proxy.ts |
| supabase-py HTTP DB 접근 | Supabase pooler ENOTFOUND + 직접 연결 IPv6 전용 → psycopg2 연결 완전 불가. 대신 supabase-py로 PostgREST REST API 사용 (HTTPS, service_role_key로 RLS 우회) | backend/app/db/supa.py |
| ES256 JWKS JWT 검증 | Supabase 신규 프로젝트는 ES256(ECDSA)으로 JWT 서명 → HS256 검증 100% 실패 → 401. JWKS 엔드포인트에서 EC 공개키 로드로 검증. HS256 fallback 유지 | backend/app/deps.py |
| PlantOut model_validator | DB plants 테이블에 `stats` JSON 컬럼 없음. `harvested_count`, `rot_count`, `active_bud_count` 개별 컬럼을 `stats` dict로 자동 합성 | backend/app/schemas/plant.py |
| admin role in profiles | `profiles.role TEXT DEFAULT 'user' CHECK (IN 'user','admin')` — zanviq.dev@gmail.com이 admin. `require_admin` 의존성으로 모든 `/admin/*` API 보호 | backend/app/deps.py |
| runtime_settings.py | 인메모리 설정 저장소. 타임 오프셋·LLM 모델·MAX_STEPS 등 런타임 변경 가능. JSON 스냅샷으로 재시작 후에도 유지 가능 | backend/app/runtime_settings.py |
| 타임 트래블 오프셋 | `rs.now() = datetime.utcnow() + timedelta(offset_seconds)` — 오프셋은 고정 델타, 시간은 계속 흐름. transition_service와 prompt_builder가 rs.now()/today() 사용 | backend/app/runtime_settings.py |
| exec_admin_query RPC | `CREATE FUNCTION exec_admin_query(sql_query text) RETURNS json` — 관리자 SQL 실행기용 Postgres 함수. SECURITY DEFINER으로 실행 | Supabase DB |
| apiFetch 네트워크 에러 | `fetch()`는 HTTP 에러는 Response로, 네트워크 단절은 TypeError를 throw. 두 경우 모두 try-catch로 감싸 ApiResult error 반환 | frontend/lib/api/client.ts |
| uvicorn reload_excludes | `*.json`, `logs/**` 제외 → 런타임 설정 저장·채팅 로그 생성 시 서버 재로드 방지 | backend/run.py |
| 회원탈퇴 cascade 삭제 | bulk delete by user_id (loop+limit 방식 대신). plants 삭제 → buds+bud_history CASCADE. conversations 삭제 → conversation_messages CASCADE. AI 로그 파일 + Supabase Auth 삭제 포함 | backend/app/services/user_service.py |

---

## 8. 알려진 이슈 & 향후 작업

### 8.1 즉시 개선 가능 (소규모)

- [ ] **봉우리 직접 수정 UI**: 상세 드로어에서 제목/detail 인라인 편집
- [ ] **식물 편집**: 이름/설명 수정 UI (API는 있음: `PATCH /plants/{id}`)
- [ ] **시간 정규화**: AI가 "오후 1시"로 저장하는데 HH:MM 포맷으로 정규화하면 좋음
- [ ] **봉우리 정렬**: 마감 임박순 / 진행률순 토글 (현재 생성순 고정)

### 8.2 중기 개선

- [ ] **모바일 반응형**: 현재 desktop 최적화, 모바일 미지원
- [ ] **봉우리 이동**: 다른 식물로 드래그 또는 이동 버튼
- [ ] **반복 일정**: recurrence 필드 추가
- [ ] **통계 차트**: 주간/월간 진행률 시각화

### 8.3 주의사항

- `backend/.env` 파일에 실제 API 키가 있음 — **절대 커밋하지 말 것** (`.gitignore` 처리됨)
- `frontend/CLAUDE.md`가 `@AGENTS.md`를 참조함 → Next.js 16 breaking changes 주의
- 정원 뷰에서 잔디 레이어(`zIndex:1`)가 버튼을 가리지 않도록 식물 레이블/버튼이 `zIndex:10` 유지 필수
- Supabase Google OAuth는 **Supabase Dashboard에서 수동 설정** 필요 (Section 5 참고)
- `SUPABASE_JWT_SECRET`은 Supabase Dashboard → Settings → API → JWT Secret (Legacy)에서 복사
- **백엔드는 psycopg2를 사용하지 않음** — supabase-py PostgREST HTTP로 DB 접근 (IPv6 전용 / 풀러 ENOTFOUND 문제 회피)
- `SUPABASE_SERVICE_ROLE_KEY`는 JWT secret으로 생성됨 (backend/.env에 이미 포함) — 노출 금지
- **백엔드 코드 변경 시 반드시 수동 재시작** (`reload=True` uvicorn 신뢰도 낮음)
  - 권장: 모든 Python 프로세스 종료 → `__pycache__` 삭제 → `python run.py` 재시작
  - `reload_excludes`로 `*.json`, `logs/**` 제외 설정됨 (런타임 설정·로그 저장 시 재로드 방지)
- **대화 기록(DB) vs AI 로그 파일 구분**:
  - 대화 기록 = `conversations` + `conversation_messages` 테이블 → `/history` 페이지에 표시
  - AI 로그 파일 = `backend/logs/chat/*.json` → 관리자 AI 로그 페이지에 표시
  - 두 저장소는 완전히 별개: AI 로그 삭제가 대화 기록에 영향 없음
- **관리자 계정**: `zanviq.dev@gmail.com` — 로그인 시 `/admin`으로 자동 리다이렉트
- **타임 트래블**: 컨트롤러 페이지에서 서버 시간 이동 가능 (데모/테스트용). 이동 후 자동 전환 스캔 실행됨

---

## 9. 세션별 작업 이력

### 세션 12 (코드 리뷰·리팩토링 + 캘린더 일정 + 세션 권한 + 알림 개선, 2026-05-30)

**1. 전면 코드 리뷰 + 리팩토링 (`0e2a364`):**
- SQLAlchemy 잔재 완전 제거: `db/session.py`, `db/base.py`, `db/models/*` 삭제
  (실제 DB 접근은 supabase-py HTTP만 사용)
- 미사용 코드 제거: plant_service 5개·plant_repo 3개·bud_service·garden_state_service
  메서드, llm_client setter, schema 5개 클래스, 미사용 import 다수
- N+1 쿼리 3건 제거 (admin list_users / get_user_conversations / get_user_plants → bulk)
- chat.py 모델 선택 버그 수정 (`user_model or global_model`)
- search/find_matches LIKE 와일드카드 이스케이프, UserOut NULL model_validator
- 31개 파일, 순 -427 라인

**2. 보안: admin SQL 실행기 감사 로깅 (`4be4f9c`)** — `/controller/sql` 호출 시
   admin user_id + 쿼리 logger.warning 기록 (기능은 유지, SELECT 제한 안 함)

**3. README 전면 재작성 (`a780873`)** — Supabase/16스킬/관리자 패널 반영

**4. layout.tsx next/script 경고 수정 (`2913789`)** — React 19 raw script 경고 →
   `<Script beforeInteractive>`, `<body>` 배치

**5. 데이터 백업/복원 (`52636c9`):** `/admin/data` 페이지에 백업 기능.
   - `backup_service.py`: 전체 테이블 ZIP 압축 (meta.json + data.json), 복원 시
     동일 PK는 건너뜀(덮어쓰기 방지), FK 순서 복원
   - `migrations/001_calendar_events.sql` 이전에 만든 백업 인프라
   - 엔드포인트: POST /admin/backup, GET /admin/backups, .../restore, .../download, DELETE

**6. 알림 상세/기록 + 실시간 (`f889f5c`):**
   - 백엔드 list_all/ack_all + `GET /notifications?include_read` + `POST /notifications/ack-all`
   - 팝오버: "안 읽음"/"전체 기록" 탭, 클릭 시 상세 확장, 관리자 메시지 본문 렌더링
     (기존엔 admin_message 종류만 뜨고 내용 안 보였음)
   - Sidebar 배지 폴링 60s → 15s (관리자 발송 후 수동 새로고침 불필요)

**7. 캘린더 직접 추가 + 독립 일정 (`da161bf`):**
   - **새 테이블 `calendar_events`** (봉우리와 별개의 순수 일정). Supabase가 마이그레이션
     도구 외부 DDL을 PostgREST에 노출하지 않아 **`exec_admin_query` RPC로 접근**
     (`calendar_event_repo.py`, _lit() 이스케이프로 주입 방지)
   - `/calendar`가 봉우리 deadline + calendar_events 병합, `source: "bud"|"event"`
   - 캘린더 페이지 "일정 추가" 모달 (제목/날짜/관련 식물 선택)
   - 스킬 `create_calendar_event`, 프롬프트에 봉우리 vs 일반 일정 판단 규칙

**8. LLM 503 재시도 (`fc54603`)** — Gemini 과부하 시 지수 백오프 3회 재시도 + 친절한 메시지

**9. AI 일반 일정 조회 (`d2431ce`)** — `list_calendar_events` 스킬. 프롬프트에서
   "식물 일정(list_buds) + 일반 일정(list_calendar_events)"을 모두 조회해 구분 설명

**10. `/delete` 명령어 (`dbbdf58`)** — 현재 세션 대화 기록 DB 완전 삭제.
    `DELETE /conversations?scope=&scope_id=`, /clear는 화면만 비움으로 라벨 변경

**11. 타임존 KST + 브리핑 staleness (`b01aace`):**
    - `app_timezone_offset_hours`(기본 9=KST) 추가. `rs.now()/today()`가 KST 기준 →
      프론트(로컬 KST)가 저장한 날짜와 "오늘"이 일치 (이전엔 UTC라 하루 어긋남)
    - 브리핑을 매 호출 재생성 (하루 캐시 staleness 제거)

**12. 세션 권한 + 입력 이관 + 캘린더 수정/삭제 (`c5ca03a`):**
    - `app/ai/permissions.py`: 세션별 수정·삭제 권한 (can_modify_bud / can_delete_plant /
      can_modify_calendar_event / guard_bud). SkillContext에 scope/scope_id 주입
    - 권한: global=전체 / plant·bud=자기 것만 / calendar=일반 일정만 (봉우리는 생성·조회만)
    - 변이 스킬 6종에 가드, 권한 밖이면 forbidden 거부
    - `update_calendar_event` / `delete_calendar_event` 스킬 신규
    - 세션 변경 배너 "변경하기" → 직전 질문을 새 세션 입력창에 이관(prefill),
      엔터만 누르면 올바른 세션에서 실행 (chatStore pendingPrefill/pendingSend)
    - 캘린더 "AI 일정 제안" 버튼 → 실제 AI 호출 (pendingSend)

**13. bud 세션 컨텍스트 (`a37c4f4`)** — bud 스코프 프롬프트에 현재 봉우리의 식물명+제목
    포함 → AI가 off-topic 감지해 세션 변경 제안 가능 (이전엔 bud_id만 알아서 감지 못함)

**14. 메인 화면 ↔ 세션 동기화 + 다크모드 수정 (`94b618f`, `e6ce24e`):**
    - 세션이 식물로 바뀌면 정원 캐러셀 선택 / 상세 페이지면 그 식물 상세로 이동
      (실제 세션 *전환*일 때만 — ref로 변화 감지, 수동 탐색은 가로채지 않음)
    - 페이지→세션: 홈·정원→global, 캘린더→calendar (chatStore.setScope)
    - 다크모드 정원 식물 이름이 밝은 하늘 배경에 묻히던 버그 → 테마 독립 어두운색 + halo

**15. 데모 가이드 + 2차 코드 리뷰·리팩토링 (`1de832d`, `5d336d7`):**
    - `DEMO_GUIDE.md` 작성 (모든 기능 파트별 테스트 시나리오 + 동작 원리)
    - 세션 12 신규 코드 리뷰 후 수정: backup_service에 calendar_events 누락 복구
      (RPC 경로로 덤프/복원), deadline_warning 스캔마다 중복 발송 방지(has_unacked),
      conversation search 부작용 제거(빈 대화 미생성), 미사용 dead code 제거,
      프론트 CalEvent 타입 중복 제거·삭제 실패 피드백·effect 의존성 보정

**16. 백업 RPC 컬럼 식별자 검증 (`fe55a76`)** — 자동 보안 리뷰 대응. _restore_rpc_rows의
    컬럼명 raw 보간을 snake_case 정규식 허용목록으로 검증(값은 이미 _lit 이스케이프).
    변조 백업의 컬럼명 주입 차단.

**17. 의존성 매니페스트 수정 + 배포 가이드 (`1959b8c`):**
    - backend requirements.txt/pyproject.toml이 실제 코드와 불일치: 누락된 `supabase`
      추가, 미사용 `sqlalchemy`/`psycopg2-binary` 제거 (새 환경 설치 시 죽던 문제)
    - `DEPLOYMENT_GUIDE.md` 작성: 프론트(Vercel) + 백엔드(Render 무료 / AWS 프리티어)
      + Supabase 설정 + 무료 플랜 한계 + 환경변수표 + 트러블슈팅

**18. 봉우리 진행률 수동 슬라이더 + 사유 팝업 (`4b2a0ca`):**
    - `PATCH /buds/{id}/progress` 신규 (BudProgressUpdate). BudService.update_progress
      재사용 → 30·60·85% 자동 전이 + 이력(note) + 0~100 clamp
    - 상세 드로어: 정적 진행률 바 → input[type=range] 슬라이더(step 5, 완료/포기는 정적)
    - 슬라이더 놓으면 "왜 변경하였나요? AI가 도움을 줄 수 있어요" 팝업 →
      "AI에게 전달"(사유 저장 후 bud 세션 AI에 pendingSend로 전달, AI는 재변경 없이 조언) /
      "그냥 저장"(사유 없이). 저장 시 bud/buds/plantBuds/stats/briefing 캐시 무효화

**현재 스킬 수: 20개** (think, match_plant, create_plant, delete_plant, create_bud,
update_bud_status, update_bud_progress, set_deadline, abandon_bud, harvest_bud,
list_plants, list_buds, get_statistics, get_garden_briefing, search_conversation,
suggest_scope_change, create_calendar_event, list_calendar_events,
update_calendar_event, delete_calendar_event)

**문서: `Plant-Counselor_Documents/`**
- `DEMO_GUIDE.md` — 모든 기능의 파트별 테스트 시나리오 + 동작 원리
- `DEPLOYMENT_GUIDE.md` — Vercel(프론트) + Render/AWS(백엔드) 무료 플랜 배포 가이드

### 세션 1 (초기 구현)
- FastAPI 백엔드 전체 구현 (8 라우터, 15 스킬, ReAct 루프)
- Next.js 프론트엔드 기본 구조 (인증, 홈, 식물, 설정)
- Zustand + TanStack Query 상태 관리

### 세션 2 (UI + 픽셀아트 정원)
- 픽셀아트 스프라이트 생성기 (`generate_pixel_sprites.py`) v5
- 정원 뷰: 가로 스크롤 캐러셀, 봉우리 슬롯 시각화, hover tooltip
- 크림/올리브 팔레트로 디자인 전면 개편 (`globals.css`)
- 다크 올리브 사이드바 (#3D4A30)
- 정원 레이아웃 버그 수정: 잔디 absolute 배치, 버튼 가림 해결

### 세션 3 (캘린더 & 일정 AI)
- 캘린더 전용 채팅 스코프 (`kind: "calendar"`)
- AI 일정 자동 분류 규칙 (prompt_builder.py)
- 캘린더 이벤트에 `plant_name`, `detail`, `type` 추가 (stats.py)
- `CalEvent` 타입 확장 (stats.ts)

### 세션 4 (문서화 + 버그 수정, 2026-05-27)
- MVP 문서 10편 작성 (`Plant-Counselor_Documents/MVP_Documents/`)
- `.gitignore` + `README.md` 작성 (root)
- `requirements.txt` 생성, `pyproject.toml` 의존성 수정
- **화살표 키 딜레이 버그 수정** (`setTimeout` → `useEffect` 분리)
- `CLAUDE.md` 작성 (이 파일)

### 세션 5 (UI 개선 + 히스토리, 2026-05-28)
- BudDetailDrawer z-index 충돌 수정 — ChatPanel 열린 채로 드로어 사용 가능
- ChatPanel 드래그 리사이즈 핸들 (min 280px ~ max 700px, localStorage persist)
- 브레드크럼 행에 "온라인" 세션 표시 이동
- 대화 기록 브라우저 (`/history`) 구현 — 2-패널, 계층 트리, 스레드 열람
- 히스토리 트리 이모지 제거, 고정 높이 스크롤 수정
- AI 봉우리 탐색 버그 수정 (prompt_builder.py + list_buds.py 강화)
- ChatPanel "새 대화" 구분선 제거
- 백엔드 `GET /conversations/list` 엔드포인트 추가
- `QK.conversations()`, `QK.historyThread()` queryKey 추가
- Sidebar에 대화 기록 링크 + hover 프리페치 추가

### 세션 6 (성능 최적화, 2026-05-28)
- 레이아웃 `prefetchAll()` — 토큰 확보 즉시 4개 쿼리 캐시 워밍
- 전 페이지 `enabled: !!accessToken` 가드 적용
- ChatPanel 브레드크럼 `useQuery` 기반으로 교체 (캐시 즉시 조회)
- `SKILL_INVALIDATIONS`에 `"briefing"` 키 추가 (6개 뮤테이션 스킬)
- BudDetailDrawer 쿼리 키 `QK.bud()` 정규화
- 캘린더 인접 월 프리페치 (`useEffect[year, month]`)
- 히스토리 트리 hover 프리페치
- MVP 문서 전체 업데이트 (이번 세션)

### 세션 11 (관리자 패널 + 컨트롤러 + 데이터 관리, 2026-05-29)

**1. 관리자 역할 시스템:**
- `profiles.role TEXT DEFAULT 'user'` DB 마이그레이션. `zanviq.dev@gmail.com` → admin 시드
- `require_admin` FastAPI 의존성 — admin 아닌 사용자 403 반환
- `UserProfile` 타입에 `role` 추가. 로그인 후 `role === "admin"` → `/admin` 리다이렉트
- `admin/layout.tsx` — 비관리자 접근 시 `/home` 리다이렉트 (프론트엔드 이중 보호)

**2. 관리자 패널 6개 페이지 (`/admin/*`):**
- `/admin` — 대시보드 (통계: 사용자·식물·봉우리·AI세션·토큰 추정)
- `/admin/users` — 사용자 테이블 + 역할 변경 (admin ↔ user) + 브로드캐스트 알림
- `/admin/users/[id]` — 사용자 상세 + 개별 알림 + AI 로그 링크
- `/admin/logs` — AI 채팅 로그 브라우저 (슬라이드 패널: 시스템 프롬프트/LLM호출/스킬/이벤트)
- `/admin/notifications` — 알림 발송 (전체·선택, 유형: 일반/공지/경고) + 발송 내역
- `/admin/data` — 데이터 관리 (개별 삭제 + 재확인 모달)

**3. 컨트롤러 페이지 (`/admin/controller`):**
- **런타임 설정**: `llm_default_model`, `llm_max_steps`, `scheduler_interval_minutes`,
  `default_wilting_days`, `default_rot_disappear_days` 등 10개 변수 인라인 수정
- **사용자별 AI 모델 오버라이드**: 각 사용자마다 다른 Gemini 모델 지정
- **SQL 실행기**: 임의 SQL 직접 실행 (SELECT/DML/DDL) + 결과 테이블, Ctrl+Enter 단축키
- **타임 트래블**: 빠른 이동 버튼 + 직접 입력 + 리셋. 양쪽 시계(실제/가상) 1초 tick
  - 시간 변경 후 자동 전환 스캔 실행 (시들음·썩음·마감 경고 즉시 반영)
- **스케줄러 즉시 실행**: 수동 전환 스캔 트리거

**4. 데이터 관리 (`/admin/data`):**
- 전체 일괄: 대화 기록 전체 삭제(DB) / AI 로그 파일만 삭제 (명확히 구분)
- 사용자별 확장 카드 (클릭 펼침) + 3개 탭:
  - **대화 기록**: 각 conversation 개별 삭제 + 전체 삭제
  - **식물**: 각 식물 개별 삭제 (봉우리·기록 cascade)
  - **봉우리**: 각 봉우리 개별 삭제 (기록 cascade)
- 모든 삭제 작업 재확인 모달 필수

**5. 회원탈퇴 완전 수정 (`user_service.py`):**
- 기존 버그: loop+limit=50, archived 식물 미삭제, 로그 파일 미삭제, auth.users 미삭제
- 수정: bulk delete by user_id (전체 상태 포함) + cascade 활용 + 로그 파일 삭제 + Supabase Auth 삭제

**6. 안정성 수정:**
- `app/layout.tsx`: `<Script beforeInteractive>` → `<script dangerouslySetInnerHTML>` (React 19 경고 수정)
- `providers.tsx`: `staleTime` 2분→30초, `refetchOnWindowFocus` false→true (실시간 반영)
- `client.ts`: `apiFetch` 모든 fetch() + _refresh() try-catch 래핑 (네트워크 TypeError 처리)
- `run.py`: `reload_excludes: [*.json, logs/**]` — 런타임 설정 저장·로그 생성 시 재로드 방지

### 세션 10 (백엔드 인프라 완전 수리 + 로그인 플로우 수정, 2026-05-29)

**1. 랜딩 페이지 버튼 네비게이션 최종 수정 (proxy.ts):**
- 구 custom auth의 `proxy.ts`가 인증 사용자를 `/login` → `/`(랜딩)으로 리다이렉트하는 버그 수정
- proxy.ts를 no-op pass-through로 재작성

**2. 프론트엔드 Auth 타이밍 버그 3개 수정 (`(app)/layout.tsx`):**
- Bug A: PKCE OAuth 콜백 중 `INITIAL_SESSION` null → `clearSession()` + `/login` 리다이렉트 → URL에 `code=` 있으면 스킵
- Bug B: `if (cachedUser) return` 조기 종료 → `SIGNED_IN` 시 항상 `/me` 재갱신
- Bug C: `/me` 500 에러 → `clearSession()` → 로그아웃. 이제 500은 세션 유지, 401만 로그아웃

**3. JWT 알고리즘 수정 (deps.py):**
- Supabase 신규 프로젝트는 **ES256** (ECDSA P-256) 서명 → 기존 HS256 검증 전부 401
- JWKS 엔드포인트에서 EC 공개키 로드 → ES256 우선 검증, HS256 legacy fallback

**4. DB 연결 완전 교체 (SQLAlchemy/psycopg2 → supabase-py):**
- Supabase pooler: `ENOTFOUND tenant/user` (Supavisor에 테넌트 미등록)
- DB 직접 연결: IPv6 전용 호스트, 머신에 IPv6 없음
- **해결**: 전체 DB 레이어를 supabase-py PostgREST HTTP로 교체
  - `backend/app/db/supa.py` 신규 — Supabase 클라이언트 싱글톤
  - 6개 repository 전체 재작성 (SQLAlchemy Session → supabase-py Client)
  - 7개 service 재작성 (db.commit()/db.refresh() 제거)
  - 8개 router 재작성 (Session → Client 타입)
  - `scheduler/jobs.py` 업데이트
  - `supabase-py` 2.30.0 설치 (`pip install supabase`)
  - `SUPABASE_SERVICE_ROLE_KEY` 환경변수 추가

**5. supabase-py API 호환성 수정:**
- `maybe_single()` → `.limit(1) + res.data[0]` (빈 결과 시 None 반환 문제)
- `nulls_last=True` → `nullsfirst=False` (PostgrestFilterRequestBuilder 파라미터 오류)

**6. PlantOut 스키마 수정 (`schemas/plant.py`):**
- DB `plants` 테이블에 `stats` 컬럼 없음 → `model_validator`로 `harvested_count`, `rot_count`, `active_bud_count` 컬럼을 `stats` dict로 자동 합성
- `BudOut` nullable 필드 optional 처리

**7. uvicorn reload 신뢰성 문제 해결:**
- `reload=True`로 실행 시 코드 변경이 메모리에 반영 안 되는 문제 빈번
- **해결책**: 코드 변경 후 모든 Python 프로세스 종료 + `__pycache__` 삭제 + `python run.py` 재시작

**8. DB 데이터 정리:**
- 테스트 스크립트로 생성된 중복 식물/봉우리 삭제
- archived 상태로 변경된 식물 active로 복원

### 세션 9 (랜딩 페이지 완성, 2026-05-28)

**버튼 네비게이션 버그 수정 (진짜 원인 발견 및 해결):**
- **진짜 원인**: `frontend/proxy.ts` — Next.js 16에서 `middleware.ts`가 `proxy.ts`로 이름 변경됨. 이 파일이 구 커스텀 인증(httpOnly 쿠키 `refresh_token`)용으로 작성됐는데, Supabase 마이그레이션 후 삭제되지 않아 문제 발생
  - 인증된 사용자(`hasRefresh` 쿠키 있음)가 `/login` 접근 시 `/`(랜딩)으로 리다이렉트 — `/home`이 돼야 함
  - Supabase는 `@supabase/supabase-js` 기본값으로 쿠키가 아닌 localStorage에 세션 저장 → 프록시가 쿠키를 체크하는 건 의미 없음
- **해결**: `proxy.ts`를 패스스루(pass-through)로 재작성 — 클라이언트 사이드 인증 가드로 충분
  - `(app)/layout.tsx` → 비인증 시 `/login` 리다이렉트
  - `AuthRedirect.tsx` (랜딩) → 인증 시 `/home` 리다이렉트
  - `login/page.tsx` → 이미 로그인 시 `/home` 리다이렉트

**`app/page.tsx` 서버 컴포넌트로 전환 (세션 8에서 시작, 이번 세션 유지):**
- `"use client"` 제거 → `<Link>` = 순수 `<a>` 태그
- `AuthRedirect.tsx` 신규 생성 (`app/_components/`) — 로그인 사용자 `/home` 리다이렉트 전담 클라이언트 컴포넌트

**랜딩 페이지 디자인 전면 재작성:**
- 이모지 완전 제거 → SVG 아이콘으로 교체 (IconChat, IconSeedling, IconCalendar, IconBell)
- Nav: 로고 + 로그인 텍스트 링크 + "무료로 시작하기" 버튼
- Hero: 강조색 하이라이트 제목, Google 아이콘 CTA, "더 알아보기" 앵커 스크롤
- Features: 4개 기능 카드 (올리브 배경 아이콘 박스)
- How it works: STEP 01-02-03 수직 구분선 레이아웃
- Bottom CTA + Footer
- 동일한 디자인 토큰 (`var(--accent)`, `var(--bg-subtle)` 등) 활용

### 세션 8 (환경 설정 완료 + 랜딩 페이지 초안, 2026-05-28)

**환경 설정 완료:**
- `backend/.env` 설정: `DATABASE_URL` (Supabase pooler, URL-인코딩 `%5E`), `SUPABASE_JWT_SECRET` (Legacy JWT Secret)
- venv 없이 전역 pip으로 패키지 설치 (`pip install -r requirements.txt`)
- 백엔드 서버 정상 기동 확인

**랜딩 페이지 + 라우트 구조 변경:**
- `app/page.tsx` 신규 생성 — 비로그인 사용자용 서비스 소개 페이지
- `app/(app)/home/page.tsx` — 대시보드를 `/home` 라우트로 이동 (기존 `/`)
- `app/(app)/page.tsx` 삭제 (루트 충돌 방지)
- `login/page.tsx` — OAuth `redirectTo` + 이미 로그인 시 리다이렉트 대상 `/` → `/home`
- `Sidebar.tsx` — 홈 링크 `/` → `/home`

### 세션 7 (Supabase 마이그레이션 + 스코프 변경 제안, 2026-05-28)

**대화 스코프 변경 제안 기능:**
- `suggest_scope_change` 스킬 추가 (16번째 스킬) — 스코프 불일치 감지 후 제안
- `prompt_builder.py` — `scope`, `scope_id`, `scope_plant_name` 파라미터 추가, "현재 상담 식물" 컨텍스트 라인 + 불일치 감지 규칙 섹션
- `chat_orchestrator.py` — scope_id → plant_name 해석 로직 추가
- `ChatPanel.tsx` — `ScopeSuggestionBanner` 컴포넌트 + `scopeSuggestion` 상태 + `onToolResult` 캡처

**Supabase PostgreSQL 마이그레이션 (백엔드):**
- Supabase 프로젝트 생성 (MCP): `mnqwrofidwotcsvsymnd`, ap-northeast-2
- MCP `apply_migration`으로 스키마 생성: `profiles`, `plants`, `buds`, `bud_history`, `garden_state`, `conversations`, `conversation_messages`, `notifications`
- RLS 정책 + `handle_new_auth_user()` DB 트리거 적용
- `config.py` — `SUPABASE_JWT_SECRET`, `DATABASE_URL` (PostgreSQL) 추가
- `deps.py` — 자체 JWT 검증 제거, python-jose로 Supabase JWT 검증 (`audience="authenticated"`)
- `db/session.py` — SQLite `check_same_thread` 제거, PostgreSQL connection pool 설정
- `db/models/user.py` — 테이블 `profiles`, `password_hash` 제거, `email` 추가
- `repositories/user_repo.py` — `create_profile()` 추가, 인증 메서드 제거
- `services/user_service.py` — `signup`, `authenticate`, `change_password` 제거
- `schemas/user.py` — `UserCreate`, `UserLogin`, `PasswordChange`, `TokenResponse` 제거
- `routers/me.py` — `POST /me/password` 제거, `DELETE /me` 간소화
- `main.py` — `auth` 라우터 제거, `Base.metadata.create_all` 제거
- **삭제**: `backend/app/auth/`, `backend/app/routers/auth.py`, `backend/alembic/`
- `pyproject.toml` — `alembic`, `passlib[argon2]` 제거; `psycopg2-binary` 추가

**Supabase Google OAuth 마이그레이션 (프론트엔드):**
- `frontend/lib/supabase.ts` 신규 생성 (`@supabase/supabase-js` 클라이언트)
- `authStore.ts` — `accessToken` Zustand persist 제거, `UserProfile` 타입 업데이트
- `api/client.ts` — `configureClient` refresh 콜백을 Supabase 기반으로 교체
- `login/page.tsx` — 자체 폼 → Google OAuth 단일 버튼
- `(app)/layout.tsx` — `onAuthStateChange` 구독으로 세션 관리 교체
- `settings/page.tsx` — 비밀번호 변경 탭 제거, `supabase.auth.signOut()` 사용
- `frontend/.env.local` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 추가
- **삭제**: `frontend/lib/api/auth.ts`

---

## 10. 다음 Claude 세션을 위한 가이드

### 작업을 시작하기 전에

1. **환경변수 확인**: `backend/.env`에 `DATABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `LLM_API_KEY` 모두 설정됐는지 확인
2. **Google OAuth 설정**: Supabase Dashboard에서 Google provider가 활성화돼 있는지 확인 (Section 5 참고)
3. **서버 실행**: 반드시 `backend/` 디렉터리에서 `python run.py` 실행 (전역 pip 설치 완료)
   - **⚠ 중요**: 코드 변경 후 반드시 수동 재시작 — `reload=True`는 신뢰 불가
   - 재시작 방법: 모든 Python 프로세스 종료 → `__pycache__` 삭제 → `python run.py`
4. **프론트엔드**: `pnpm dev` (Next.js 16)
5. **DB 접근 방식**: supabase-py HTTP (psycopg2 직접 연결 사용 안 함)

### 새 기능 추가 시 체크리스트

**백엔드 스킬 추가**:
```python
# 1. backend/app/ai/skills/새스킬.py 생성 (SkillBase 상속)
# 2. backend/app/routers/chat.py — _build_registry()에 등록
# 3. frontend/components/chat/ChatPanel.tsx — SKILL_INVALIDATIONS 맵에 추가
```

**API 엔드포인트 추가**:
```python
# 1. backend/app/routers/새라우터.py
# 2. backend/app/main.py — app.include_router() 추가
# 3. frontend/lib/api/새라우터.ts — fetch 함수 작성
```

**새 페이지**:
```typescript
// frontend/app/(app)/새페이지/page.tsx
// components/layout/Sidebar.tsx — nav 링크 추가
```

### 코드 컨벤션

- Python: `from __future__ import annotations`, type hints 필수
- TypeScript: `"use client"` 최상단, Tailwind 대신 inline style (이 프로젝트 관행)
- 컴포넌트: 하나의 파일에 관련 컴포넌트 모두 (PlantCard, GardenPlant 등을 page.tsx에)
- DB 변경 없는 MVP 타협 허용: detail 필드에 시간 저장 등

**백엔드 DB 접근 패턴 (supabase-py)**:
```python
# Repository 패턴 — supabase Client 사용
from supabase import Client
from types import SimpleNamespace

def _row(d): return SimpleNamespace(**d) if d else None

class MyRepo:
    def __init__(self, db: Client): self.db = db
    
    def get(self, id): 
        res = self.db.table("table").select("*").eq("id", id).limit(1).execute()
        return _row(res.data[0]) if res.data else None  # ← maybe_single() 사용 금지
    
    def list(self, user_id):
        res = self.db.table("table").select("*").eq("user_id", user_id).execute()
        return [SimpleNamespace(**d) for d in res.data or []]
    
    def create(self, data: dict):
        res = self.db.table("table").insert(data).execute()
        return _row(res.data[0])
    
    def update(self, id, fields: dict):
        res = self.db.table("table").update(fields).eq("id", id).execute()
        return _row(res.data[0]) if res.data else None

# Service 패턴 — db.commit() / db.refresh() 없음 (supabase-py auto-commits)
class MyService:
    def __init__(self, db: Client): self._repo = MyRepo(db)
    def create(self, ...): return self._repo.create(...)  # 바로 반환
```

---

## 11. 참고 문서 링크

| 문서 | 내용 |
|------|------|
| `README.md` | 빠른 시작 가이드 (venv, requirements.txt 설명 포함) |
| `MVP_Documents/00_Overview.md` | 기능 목록, 기술 스택, 디렉터리 구조 |
| `MVP_Documents/04_AI_Chat_And_Skills.md` | ReAct 루프, 15 스킬, 프롬프트 설계 |
| `MVP_Documents/05_Backend_Code_Walkthrough.md` | 모든 Python 파일 설명 |
| `MVP_Documents/06_API_Reference.md` | REST 엔드포인트 전체 명세 |
| `MVP_Documents/09_Summary.md` | 핵심 동작 흐름 다이어그램 |
| `MVP_Documents/10_Complete_Implementation_State.md` | **최신** 전체 구현 상태 |
