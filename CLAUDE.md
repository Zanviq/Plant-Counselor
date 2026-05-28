# Plant Counselor — CLAUDE.md

> **다음 Claude 세션을 위한 핸드오프 문서**  
> 최종 업데이트: 2026-05-28 (세션 9)  
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

---

## 3. 기술 스택

| 계층 | 기술 |
|------|------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS v4, Zustand, TanStack Query v5 |
| **Backend** | FastAPI, SQLAlchemy 2.x, Pydantic v2, APScheduler |
| **LLM** | Google Gemini 2.5 Flash (`google-genai` SDK) |
| **DB** | Supabase PostgreSQL (psycopg2-binary) + Row Level Security |
| **Auth** | Supabase Auth (Google OAuth) + python-jose JWT 검증 + Fernet (API 키 암호화) |
| **BaaS** | Supabase (프로젝트 ID: `mnqwrofidwotcsvsymnd`, region: ap-northeast-2) |
| **ID** | ULID (python-ulid) |

---

## 4. 프로젝트 구조 (핵심 파일만)

```
plant-counselor/
├── backend/
│   ├── app/
│   │   ├── ai/
│   │   │   ├── chat_orchestrator.py  ← ReAct 루프 (MAX_STEPS=10)
│   │   │   ├── llm_client.py         ← Gemini API 래퍼
│   │   │   ├── prompt_builder.py     ← 시스템 프롬프트 (행동 규칙 포함)
│   │   │   ├── skill_registry.py     ← 스킬 등록 + catalog
│   │   │   └── skills/               ← 16개 스킬 각 파일 (suggest_scope_change 포함)
│   │   ├── db/models/                ← 8개 ORM 모델
│   │   ├── routers/                  ← 8개 FastAPI 라우터
│   │   │   ├── chat.py               ← POST /chat/message (SSE)
│   │   │   └── stats.py              ← /calendar (plant_name, detail 포함)
│   │   ├── services/
│   │   │   ├── bud_service.py        ← 진행률 자동 전이 로직
│   │   │   └── transition_service.py ← 시들/썩음 자동 전이
│   │   ├── config.py                 ← pydantic-settings
│   │   └── main.py                   ← FastAPI app
│   ├── pyproject.toml                ← 의존성 (google-genai, fastapi 등)
│   ├── requirements.txt              ← pip install -r 용
│   └── .env.example                  ← 환경변수 템플릿
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx                  ← 랜딩 페이지 "/" (서버 컴포넌트, Link 네비 정상)
│   │   ├── _components/
│   │   │   └── AuthRedirect.tsx      ← 로그인 유저 → /home 리다이렉트 (클라이언트)
│   │   ├── globals.css               ← 디자인 토큰 (크림/올리브 팔레트)
│   │   ├── (app)/home/page.tsx       ← 대시보드 "/home" (구 "/" 홈)
│   │   ├── (app)/plants/page.tsx     ← 정원 뷰 + 화살표 키 네비
│   │   ├── (app)/calendar/page.tsx   ← 캘린더 + 일정 AI 채팅
│   │   └── (app)/settings/page.tsx   ← 5탭 설정
│   ├── components/
│   │   ├── chat/ChatPanel.tsx        ← SSE, 명령어, 스코프 breadcrumb
│   │   └── layout/Sidebar.tsx        ← 다크 올리브 사이드바 (홈 링크: /home)
│   ├── lib/
│   │   ├── api/stats.ts              ← CalEvent 타입 (plant_name, detail 포함)
│   │   └── store/chatStore.ts        ← ChatScope.kind: "global"|"plant"|"bud"|"calendar"
│   └── public/sprites/               ← 픽셀아트 PNG 파일들
│
├── scripts/generate_pixel_sprites.py ← Pillow 스프라이트 생성기
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
# Supabase PostgreSQL 연결 (Dashboard → Settings → Database → Connection string)
DATABASE_URL=postgresql+psycopg2://postgres:[비밀번호]@db.mnqwrofidwotcsvsymnd.supabase.co:5432/postgres

# Supabase JWT 서명 키 (Dashboard → Settings → API → JWT Secret)
SUPABASE_JWT_SECRET=여기에-supabase-jwt-secret

# Google AI Studio API 키
LLM_API_KEY=AIzaSy...

# API 키 암호화용 (32자 이상 랜덤 문자열)
KEY_ENCRYPTION_SECRET=여기에-32자-이상-랜덤-문자열

CORS_ALLOW_ORIGIN=http://localhost:3000
```

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
- `SUPABASE_JWT_SECRET`은 Supabase Dashboard → Settings → API → JWT Secret에서 복사
- DB 비밀번호는 Dashboard → Settings → Database → Connection string에서 확인

---

## 9. 세션별 작업 이력

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

1. **환경변수 확인**: `backend/.env`에 `DATABASE_URL`, `SUPABASE_JWT_SECRET`, `LLM_API_KEY` 모두 설정됐는지 확인
2. **Google OAuth 설정**: Supabase Dashboard에서 Google provider가 활성화돼 있는지 확인 (Section 5 참고)
3. **서버 실행** 확인: `python run.py` (venv 없이 전역 pip 설치 완료) + `pnpm dev`
4. **기존 문서 읽기**:
   - `Plant-Counselor_Documents/MVP_Documents/10_Complete_Implementation_State.md` — 최신 전체 상태
   - `Plant-Counselor_Documents/MVP_Documents/04_AI_Chat_And_Skills.md` — AI 시스템 상세

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
