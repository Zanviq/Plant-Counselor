# Plant Counselor

> 고민과 일정을 식물 생애주기에 비유해 함께 가꾸는 AI 정원사.

자연어로 말하면 AI가 **식물**(분야)과 **봉우리**(고민/일정)를 자동으로 만들고, 진행 상황을 추적합니다. 봉우리는 씨앗에서 시작해 성장하고, 결실을 맺어 수확하거나 방치되면 시들고 썩습니다.

---

## 주요 기능

- **AI 정원사 채팅** — 16개 스킬을 멀티스텝으로 자동 실행 (ReAct 패턴, SSE 스트리밍)
- **4가지 채팅 스코프** — 전체 / 식물별 / 봉우리별 / 캘린더
- **식물 관리** — 분야별 카테고리 + 봉우리(고민/일정) 7상태 라이프사이클 추적
- **픽셀아트 정원** — 스프라이트 합성 + 봉우리 슬롯 시각화 + 가로 캐러셀
- **캘린더** — 마감 일정 월별 그리드 + 캘린더 전용 AI 채팅
- **대화 기록** — 스코프별 대화 트리 브라우저 (`/history`)
- **알림** — 시들/썩음/마감 임박 자동 알림 (주기 변경 가능)
- **테마** — light / dark / system + 4가지 강조색
- **관리자 패널** (`/admin`) — 사용자/AI 로그/알림/데이터 관리
- **컨트롤러** — 런타임 설정 + SQL 실행기 + **타임 트래블** (데모용 서버 시간 이동)

## 기술 스택

| 계층     | 기술                                                                       |
| -------- | -------------------------------------------------------------------------- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind v4, Zustand, TanStack Query v5  |
| Backend  | FastAPI, **supabase-py** (PostgREST HTTP), Pydantic v2, APScheduler        |
| LLM      | Google Gemini 2.5 Flash (`google-genai` SDK)                               |
| DB       | **Supabase PostgreSQL** + Row Level Security                               |
| Auth     | **Supabase Auth (Google OAuth)** + ES256 JWKS 검증 + Fernet (API 키 암호화) |
| ID       | ULID (python-ulid)                                                         |

> **DB 접근 방식**: 직접 psycopg2 연결 대신 supabase-py PostgREST HTTP API를 사용합니다.
> (Supabase pooler ENOTFOUND / 직접 연결 IPv6 전용 문제 회피)

---

## 빠른 시작

### 요구 사항

- Python 3.11+
- Node.js 20+ / pnpm
- Gemini API 키 ([Google AI Studio](https://aistudio.google.com/)에서 발급)
- Supabase 프로젝트 + Google OAuth Provider 설정

---

### 백엔드 설정

#### 1. 가상환경(`.venv`) 생성 및 활성화

Python 패키지를 전역 환경에 설치하면 다른 프로젝트와 버전 충돌이 발생합니다.
`.venv`는 이 프로젝트 전용 독립 Python 환경입니다.

```bash
cd backend

# 가상환경 생성 (한 번만)
python -m venv .venv
```

활성화 (터미널을 새로 열 때마다 필요):

```bash
# Windows (PowerShell)
.venv\Scripts\Activate.ps1

# Windows (cmd.exe)
.venv\Scripts\activate.bat

# Mac / Linux
source .venv/bin/activate
```

활성화되면 프롬프트 앞에 `(.venv)` 가 표시됩니다.

비활성화:

```bash
deactivate
```

---

#### 2. 패키지 설치

이 프로젝트는 `pyproject.toml`을 단일 의존성 출처로 사용합니다.

**방법 A — 개발 모드 설치 (권장)**

```bash
pip install -e .
```

> `-e` (`--editable`) 플래그는 `pyproject.toml`에 선언된 모든 패키지를 설치하되,
> 소스 코드를 복사하지 않고 현재 폴더를 직접 참조합니다.
> `app/` 폴더의 코드를 수정하면 즉시 반영됩니다.

**방법 B — requirements.txt 로 설치**

```bash
pip install -r requirements.txt
```

두 방법은 설치되는 패키지가 동일합니다.

---

#### 3. 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열어 아래 값들을 채웁니다:

```dotenv
# Supabase PostgreSQL pooler 연결 (실제 DB 접근은 supabase-py HTTP)
DATABASE_URL=postgresql+psycopg2://postgres.PROJECT_REF:PASSWORD@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres

# Supabase 프로젝트 URL
SUPABASE_URL=https://PROJECT_REF.supabase.co

# Supabase JWT Legacy Secret (Dashboard → Settings → API → JWT Secret → Legacy)
SUPABASE_JWT_SECRET=여기에-supabase-legacy-jwt-secret

# Supabase 서비스 롤 키 (DB 접근에 필수)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# Google AI Studio Gemini API 키
LLM_API_KEY=AIzaSy...

# 사용자별 API 키 암호화용 (32자 이상 랜덤 문자열)
KEY_ENCRYPTION_SECRET=여기에-32자-이상-랜덤-문자열

CORS_ALLOW_ORIGIN=http://localhost:3000
```

> `.env` 파일은 `.gitignore`에 등록되어 있어 **절대 저장소에 올라가지 않습니다.**

#### Supabase Google OAuth 설정 (수동)

1. Supabase Dashboard → Authentication → Providers → Google → Enable
2. Google Cloud Console에서 OAuth 2.0 클라이언트 ID/Secret 발급
3. Authorized redirect URI 추가: `https://PROJECT_REF.supabase.co/auth/v1/callback`
4. Client ID/Secret을 Supabase Dashboard에 입력

---

#### 4. 서버 실행

```bash
python run.py   # http://localhost:8000
```

API 문서 자동 생성: [http://localhost:8000/docs](http://localhost:8000/docs)

> **⚠ 코드 변경 시**: `reload=True` 동작이 불안정할 수 있어 수동 재시작 권장.
> Python 프로세스 종료 → `__pycache__` 삭제 → `python run.py` 재실행.

---

### 프론트엔드 설정

```bash
cd frontend
pnpm install    # node_modules 설치 (최초 1회)
```

`frontend/.env.local` 파일 생성 후 Supabase 클라이언트 키 설정:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
NEXT_PUBLIC_API_BASE=http://localhost:8000/api/v1
```

```bash
pnpm dev        # http://localhost:3000
```

> **pnpm이 없다면:**
> ```bash
> npm install -g pnpm
> ```

---

### 스프라이트 재생성 (선택)

픽셀아트 식물/봉우리 이미지를 새로 그리고 싶을 때:

```bash
# 루트 디렉터리에서
pip install Pillow
python scripts/generate_pixel_sprites.py
cp assets/sprites/* frontend/public/sprites/
```

---

## 환경 변수

`backend/.env` 파일에 설정합니다.

| 변수                        | 필수 | 설명                                                   |
| --------------------------- | ---- | ------------------------------------------------------ |
| `DATABASE_URL`              | ✅   | Supabase pooler 연결 문자열 (URL-인코딩된 비밀번호 사용) |
| `SUPABASE_URL`              | ✅   | Supabase 프로젝트 URL                                   |
| `SUPABASE_JWT_SECRET`       | ✅   | JWT 서명 검증용 (HS256 fallback)                        |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅   | DB HTTP 접근용 (RLS 우회)                              |
| `LLM_API_KEY`               | ✅   | Gemini API 키 (사용자별 키의 fallback)                 |
| `KEY_ENCRYPTION_SECRET`     | ✅   | 사용자 API 키 암호화 시크릿 (32자 이상)                |
| `CORS_ALLOW_ORIGIN`         | —    | 기본값: `http://localhost:3000`                         |

`frontend/.env.local`:

| 변수                            | 필수 | 설명                                |
| ------------------------------- | ---- | ----------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | ✅   | Supabase 프로젝트 URL                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅   | Supabase 공개 anon 키                |
| `NEXT_PUBLIC_API_BASE`          | —    | 기본값: `http://localhost:8000/api/v1` |

---

## 의존성 구조

### 백엔드 (`backend/pyproject.toml`)

```
fastapi + uvicorn              — HTTP API 서버
supabase                       — PostgREST HTTP 클라이언트 (DB 접근)
python-jose                    — Supabase JWT 검증 (ES256/HS256)
pydantic + pydantic-settings   — 데이터 검증 + .env 바인딩
google-genai                   — Gemini 2.5 Flash LLM SDK
apscheduler                    — 주기적 봉우리 자동 상태 전이
python-ulid                    — 정렬 가능 ULID 기본키
cryptography                   — Fernet 대칭 암호화 (사용자 API 키)
```

### 프론트엔드 (`frontend/package.json`)

```
next 16 + react 19         — App Router SSR 프레임워크
@supabase/supabase-js      — Auth + Google OAuth
tailwindcss v4             — 유틸리티 CSS
zustand                    — 전역 상태 (auth, chat, theme)
@tanstack/react-query      — 서버 상태 캐싱 + 자동 재요청
typescript                 — 정적 타입 검사
```

---

## 프로젝트 구조

```
plant-counselor/
├── backend/
│   ├── app/
│   │   ├── ai/
│   │   │   ├── chat_orchestrator.py  # ReAct 루프 (MAX_STEPS runtime_settings)
│   │   │   ├── llm_client.py         # Gemini API 래퍼
│   │   │   ├── prompt_builder.py     # 시스템 프롬프트 빌더
│   │   │   ├── skill_registry.py     # 스킬 등록 + catalog
│   │   │   └── skills/               # 16개 스킬
│   │   ├── db/
│   │   │   └── supa.py               # Supabase 클라이언트 싱글톤
│   │   ├── repositories/             # DB CRUD (supabase-py 기반)
│   │   ├── services/                 # 비즈니스 로직
│   │   ├── schemas/                  # Pydantic 스키마
│   │   ├── routers/                  # 8개 라우터 (chat/plants/buds/...)
│   │   ├── scheduler/                # APScheduler 잡 등록
│   │   ├── runtime_settings.py       # 런타임 변수 (타임 트래블 등)
│   │   ├── config.py                 # pydantic-settings
│   │   ├── deps.py                   # require_user, require_admin
│   │   └── main.py                   # FastAPI app
│   ├── pyproject.toml                # 의존성 선언 (단일 출처)
│   ├── requirements.txt              # pyproject.toml 미러
│   ├── .env.example                  # 환경변수 템플릿
│   ├── .env                          # 실제 시크릿 (gitignore됨)
│   ├── .venv/                        # 가상환경 (gitignore됨)
│   ├── logs/chat/                    # AI 채팅 로그 (JSON)
│   └── run.py                        # uvicorn 진입점
├── frontend/
│   ├── app/
│   │   ├── (app)/                    # 인증 사용자 페이지
│   │   │   ├── home/                 # 대시보드
│   │   │   ├── plants/               # 정원 뷰
│   │   │   ├── calendar/             # 캘린더
│   │   │   ├── history/              # 대화 기록 브라우저
│   │   │   └── settings/             # 5탭 설정
│   │   ├── (auth)/login/             # Supabase Google OAuth
│   │   ├── admin/                    # 관리자 패널 (role=admin만)
│   │   │   ├── users/                # 사용자 관리
│   │   │   ├── logs/                 # AI 로그 브라우저
│   │   │   ├── notifications/        # 알림 발송
│   │   │   ├── data/                 # 데이터 개별 삭제
│   │   │   └── controller/           # 런타임 설정 + SQL + 타임 트래블
│   │   └── page.tsx                  # 랜딩 페이지
│   ├── components/                   # ChatPanel, Sidebar, NotificationsPopover
│   ├── lib/                          # API client, Zustand stores, Supabase
│   └── public/sprites/               # 픽셀아트 스프라이트
├── assets/sprites/                   # 스프라이트 원본
├── scripts/                          # 스프라이트 생성기
├── ref_images/                       # 디자인 레퍼런스
├── CLAUDE.md                         # 다음 세션을 위한 핸드오프 문서
└── Plant-Counselor_Documents/
    └── MVP_Documents/                # 상세 문서 10편
```

---

## 핵심 흐름

```
사용자: "취업 식물 만들고 면접 준비 봉우리 추가해줘"
  ↓
ChatOrchestrator.run() — 동기 SSE 제너레이터
  ↓
ReAct 루프 (MAX_STEPS=10):
  think → match_plant("취업") → create_plant("취업")
        → create_bud("면접 준비") → 최종 응답 스트리밍
  ↓
SSE 이벤트: start → tool_call → tool_result → token* → done
  ↓
프론트엔드: skill별 queryKey 자동 무효화 (SKILL_INVALIDATIONS)
  ↓
정원에 식물+봉우리 즉시 반영, 통계 자동 갱신
```

### 봉우리 7상태 라이프사이클

```
씨앗(seed) → 새싹(bud) → 꽃(flower) → 열매(fruit) → 수확(harvested)
                ↓ (방치)
              시들음(wilting) → 썩음(rot)
```

진행률 30% / 60% / 85% 임계값에서 자동 상태 전이.
설정 가능한 일수 (`default_wilting_days`, `default_rot_disappear_days`)
이상 활동이 없으면 시들음 → 썩음.

---

## 관리자 기능

`zanviq.dev@gmail.com`이 기본 admin 계정. `profiles.role = 'admin'`인 사용자만
`/admin/*` 경로 접근 가능 (`require_admin` 의존성 + 프론트엔드 가드 이중 보호).

| 페이지              | 기능                                                              |
| ------------------- | ----------------------------------------------------------------- |
| `/admin`            | 대시보드 (사용자/식물/봉우리/AI세션/토큰 통계)                    |
| `/admin/users`      | 사용자 목록 + 역할 변경 (user ↔ admin) + 알림 발송                |
| `/admin/logs`       | AI 채팅 로그 브라우저 (시스템 프롬프트/LLM 호출/스킬/이벤트)      |
| `/admin/notifications` | 알림 발송 (전체/선택, 일반/공지/경고) + 발송 내역              |
| `/admin/data`       | 대화/식물/봉우리 개별 삭제 (재확인 모달)                          |
| `/admin/controller` | 런타임 설정 + 사용자별 모델 오버라이드 + SQL 실행기 + 타임 트래블 |

> **타임 트래블**: 컨트롤러 페이지에서 서버 시간을 이동시켜 시들음/썩음/마감
> 경고 동작을 데모/테스트할 수 있습니다. 이동 후 자동으로 전환 스캔이 실행됩니다.

---

## 문서

상세 문서는 [`Plant-Counselor_Documents/MVP_Documents/`](./Plant-Counselor_Documents/MVP_Documents/) 에 있습니다.

- [00 - 프로젝트 개요](./Plant-Counselor_Documents/MVP_Documents/00_Overview.md)
- [01 - 아키텍처](./Plant-Counselor_Documents/MVP_Documents/01_Architecture.md)
- [04 - AI 채팅 & 스킬](./Plant-Counselor_Documents/MVP_Documents/04_AI_Chat_And_Skills.md)
- [05 - 백엔드 코드 워크스루](./Plant-Counselor_Documents/MVP_Documents/05_Backend_Code_Walkthrough.md)
- [06 - API 레퍼런스](./Plant-Counselor_Documents/MVP_Documents/06_API_Reference.md)
- [08 - 운영](./Plant-Counselor_Documents/MVP_Documents/08_Operations.md)
- [09 - 전체 요약](./Plant-Counselor_Documents/MVP_Documents/09_Summary.md)

다음 Claude 세션을 위한 핸드오프 문서는 [`CLAUDE.md`](./CLAUDE.md) 참고.

---

## 라이선스

Private project.
