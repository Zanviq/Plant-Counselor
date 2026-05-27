# Plant Counselor — CLAUDE.md

> **다음 Claude 세션을 위한 핸드오프 문서**  
> 최종 업데이트: 2026-05-27  
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
| 인증 (JWT + Argon2 + 리프레시 쿠키) | ✅ 완성 |
| 식물 CRUD | ✅ 완성 |
| 봉우리 CRUD + 7상태 생애주기 | ✅ 완성 |
| AI 채팅 (ReAct, 15 스킬, SSE 스트리밍) | ✅ 완성 |
| 4가지 채팅 스코프 (global/plant/bud/calendar) | ✅ 완성 |
| 캘린더 (이벤트 표시, 식물명/시간 포함) | ✅ 완성 |
| 캘린더 전용 AI 채팅 | ✅ 완성 |
| 픽셀아트 정원 (스프라이트, 슬롯, 캐러셀) | ✅ 완성 |
| 화살표 키 네비게이션 (딜레이 없음) | ✅ 완성 |
| 알림 (시들/썩음/마감 임박) | ✅ 완성 |
| 테마 (light/dark/system + 4종 강조색) | ✅ 완성 |
| 설정 (5탭, API 키 암호화) | ✅ 완성 |
| 10분 주기 자동 전이 (APScheduler) | ✅ 완성 |
| requirements.txt + README (venv 설명) | ✅ 완성 |

---

## 3. 기술 스택

| 계층 | 기술 |
|------|------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS v4, Zustand, TanStack Query v5 |
| **Backend** | FastAPI, SQLAlchemy 2.x, Pydantic v2, APScheduler |
| **LLM** | Google Gemini 2.5 Flash (`google-genai` SDK) |
| **DB** | SQLite (dev) / PostgreSQL (prod 예정) |
| **Auth** | JWT (python-jose) + Argon2 (passlib) + Fernet (cryptography) |
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
│   │   │   └── skills/               ← 15개 스킬 각 파일
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
│   │   ├── globals.css               ← 디자인 토큰 (크림/올리브 팔레트)
│   │   ├── (app)/plants/page.tsx     ← 정원 뷰 + 화살표 키 네비
│   │   ├── (app)/calendar/page.tsx   ← 캘린더 + 일정 AI 채팅
│   │   └── (app)/settings/page.tsx   ← 5탭 설정
│   ├── components/
│   │   ├── chat/ChatPanel.tsx        ← SSE, 명령어, 스코프 breadcrumb
│   │   └── layout/Sidebar.tsx        ← 다크 올리브 사이드바
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
pip install -e .
cp .env.example .env
# .env 편집: LLM_API_KEY, JWT_SECRET, KEY_ENCRYPTION_SECRET 입력
python run.py                 # → http://localhost:8000
# API 문서: http://localhost:8000/docs

# 프론트엔드 (새 터미널)
cd frontend
pnpm install
pnpm dev                      # → http://localhost:3000
```

### 필수 환경변수 (.env)

```dotenv
DATABASE_URL=sqlite:///./plant_counselor.db
JWT_SECRET=여기에-32자-이상-랜덤-문자열
LLM_API_KEY=AIzaSy...         # Google AI Studio에서 발급
KEY_ENCRYPTION_SECRET=여기에-32자-이상-랜덤-문자열
CORS_ALLOW_ORIGIN=http://localhost:3000
```

---

## 6. 핵심 설계 패턴 & 컨벤션

### 6.1 AI 시스템

```
사용자 발화
  → POST /chat/message {text, scope, scope_id, current_screen}
  → ChatOrchestrator.run() — 동기 SSE 제너레이터
  → PromptBuilder.build_system() — 정원 현황 + 행동 규칙 7섹션
  → ReAct 루프 (MAX_STEPS=10)
       LLM → tool_use? → registry.dispatch() → working_history 업데이트 → 반복
       텍스트 응답 → token 이벤트 스트리밍
  → SSE: start → (tool_call → tool_result)* → token* → done
```

- **질문 금지**: AI는 확인 없이 의도를 추론·즉시 실행
- **일정 자동 분류**: "밥먹기"→일상, "면접"→취업, "오늘"→ISO 날짜
- **스킬 등록 순서**: `think` 먼저 → LLM이 복잡 작업 시 자연스럽게 선택

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
- [ ] **PostgreSQL 연동**: prod 환경 (현재 SQLite)

### 8.3 주의사항

- `backend/.env` 파일에 실제 API 키가 있음 — **절대 커밋하지 말 것** (`.gitignore` 처리됨)
- `frontend/CLAUDE.md`가 `@AGENTS.md`를 참조함 → Next.js 16 breaking changes 주의
- 정원 뷰에서 잔디 레이어(`zIndex:1`)가 버튼을 가리지 않도록 식물 레이블/버튼이 `zIndex:10` 유지 필수

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

### 세션 4 (문서화 + 버그 수정)
- MVP 문서 10편 작성 (`Plant-Counselor_Documents/MVP_Documents/`)
- `.gitignore` + `README.md` 작성 (root)
- `requirements.txt` 생성, `pyproject.toml` 의존성 수정
- **화살표 키 딜레이 버그 수정** (`setTimeout` → `useEffect` 분리)
- `CLAUDE.md` 작성 (이 파일)

---

## 10. 다음 Claude 세션을 위한 가이드

### 작업을 시작하기 전에

1. **서버 실행** 확인: `python run.py` + `pnpm dev`
2. **기존 문서 읽기**:
   - `Plant-Counselor_Documents/MVP_Documents/10_Complete_Implementation_State.md` — 최신 전체 상태
   - `Plant-Counselor_Documents/MVP_Documents/04_AI_Chat_And_Skills.md` — AI 시스템 상세
   - `Plant-Counselor_Documents/MVP_Documents/05_Backend_Code_Walkthrough.md` — 백엔드 코드 상세
3. **현재 기능 파악** 후 사용자에게 무엇을 개선할지 물어볼 것

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
