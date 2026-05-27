# Plant Counselor

> 고민과 일정을 식물 생애주기에 비유해 함께 가꾸는 AI 정원사.

자연어로 말하면 AI가 **식물**(분야)과 **봉우리**(고민/일정)를 자동으로 만들고, 진행 상황을 추적합니다. 봉우리는 씨앗에서 시작해 성장하고, 결실을 맺어 수확하거나 방치되면 시들고 썩습니다.

---

## 주요 기능

- **AI 정원사 채팅** — 15개 스킬을 멀티스텝으로 자동 실행 (ReAct 패턴)
- **식물 관리** — 분야별 카테고리 + 봉우리(고민/일정) 라이프사이클 추적
- **픽셀아트 정원** — 스프라이트 합성 + 봉우리 슬롯 시각화 + 가로 캐러셀
- **캘린더** — 마감 일정 월별 그리드 + 캘린더 전용 AI 채팅
- **알림** — 시들/썩음/마감 임박 자동 알림 (10분 주기)
- **테마** — light / dark / system + 4가지 강조색

## 기술 스택

| 계층     | 기술                                                                   |
| -------- | ---------------------------------------------------------------------- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind v4, Zustand, TanStack Query |
| Backend  | FastAPI, SQLAlchemy 2.x, Pydantic v2, APScheduler                      |
| LLM      | Google Gemini 2.5 Flash (`google-genai` SDK)                           |
| DB       | SQLite (dev) / PostgreSQL (prod)                                       |
| Auth     | JWT + Argon2 + Fernet                                                  |

---

## 빠른 시작

### 요구 사항

- Python 3.11+
- Node.js 20+ / pnpm
- Gemini API 키 ([Google AI Studio](https://aistudio.google.com/)에서 발급)

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

> **`python -m venv .venv` 란?**  
> `venv` 모듈로 현재 폴더 안에 `.venv/` 디렉터리를 만들고,  
> 그 안에 독립 Python 인터프리터 + pip + site-packages를 복사합니다.  
> `.venv/` 는 `.gitignore`에 등록되어 있어 저장소에 올라가지 않습니다.

활성화 (터미널을 새로 열 때마다 필요):

```bash
# Windows (PowerShell)
.venv\Scripts\Activate.ps1

# Windows (cmd.exe)
.venv\Scripts\activate.bat

# Mac / Linux
source .venv/bin/activate
```

활성화되면 프롬프트 앞에 `(.venv)` 가 표시됩니다:

```
(.venv) PS C:\...\backend>
```

비활성화:

```bash
deactivate
```

---

#### 2. 패키지 설치

이 프로젝트는 `pyproject.toml`을 단일 의존성 출처로 사용합니다.  
두 가지 방법 중 하나를 선택합니다.

**방법 A — 개발 모드 설치 (권장)**

```bash
pip install -e .
```

> **`pip install -e .` 란?**  
> `-e` (`--editable`) 플래그는 `pyproject.toml`에 선언된 모든 패키지를 설치하되,  
> 소스 코드를 복사하지 않고 현재 폴더를 직접 참조합니다.  
> `app/` 폴더의 코드를 수정하면 서버 재시작 없이 즉시 반영됩니다.  
> `.`은 현재 폴더(`backend/`)를 가리킵니다.

**방법 B — requirements.txt 로 설치**

```bash
pip install -r requirements.txt
```

> **`requirements.txt` 란?**  
> `pyproject.toml`의 의존성을 그대로 옮긴 파일입니다.  
> `pip install -e .` 가 익숙하지 않거나, CI/CD 환경에서 쓰기 좋습니다.  
> 두 방법은 설치되는 패키지가 동일합니다.  
> 버전 변경 시 `pyproject.toml`을 먼저 수정하고 `requirements.txt`도 동기화하세요.

---

#### 3. 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열어 아래 값들을 채웁니다:

```dotenv
DATABASE_URL=sqlite:///./plant_counselor.db
JWT_SECRET=여기에-긴-랜덤-문자열
LLM_API_KEY=AIzaSy...   # Google AI Studio에서 발급한 Gemini API 키
KEY_ENCRYPTION_SECRET=32자-이상-랜덤-문자열
CORS_ALLOW_ORIGIN=http://localhost:3000
```

> `.env` 파일은 `.gitignore`에 등록되어 있어 **절대 저장소에 올라가지 않습니다.**

---

#### 4. 서버 실행

```bash
python run.py   # http://localhost:8000
```

API 문서 자동 생성: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### 프론트엔드 설정

```bash
cd frontend
pnpm install    # node_modules 설치 (최초 1회)
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

| 변수                    | 기본값                           | 설명                                       |
| ----------------------- | -------------------------------- | ------------------------------------------ |
| `DATABASE_URL`          | `sqlite:///./plant_counselor.db` | DB 연결 문자열                             |
| `JWT_SECRET`            | `dev-secret`                     | JWT 서명 시크릿 (**prod에서 반드시 교체**) |
| `JWT_ACCESS_TTL`        | `15`                             | 액세스 토큰 유효시간 (분)                  |
| `JWT_REFRESH_TTL`       | `14`                             | 리프레시 토큰 유효시간 (일)                |
| `LLM_API_KEY`           | —                                | Gemini API 키 (사용자별 키의 fallback)     |
| `KEY_ENCRYPTION_SECRET` | `dev-encryption-...`             | 사용자 API 키 암호화 시크릿                |
| `CORS_ALLOW_ORIGIN`     | `http://localhost:3000`          | 프론트엔드 도메인                          |

---

## 의존성 구조

### 백엔드 (`backend/pyproject.toml`)

```
fastapi + uvicorn       — HTTP API 서버
sqlalchemy + alembic    — ORM + DB 마이그레이션
python-jose + passlib   — JWT 토큰 + Argon2 해싱
pydantic + pydantic-settings — 데이터 검증 + .env 바인딩
google-genai            — Gemini 2.5 Flash LLM SDK
apscheduler             — 10분 주기 봉우리 자동 상태 전이
python-ulid             — 정렬 가능 ULID 기본키
cryptography            — Fernet 대칭 암호화 (사용자 API 키)
```

### 프론트엔드 (`frontend/package.json`)

```
next 16 + react 19      — App Router SSR 프레임워크
tailwindcss v4          — 유틸리티 CSS
zustand                 — 전역 상태 (chat, theme)
@tanstack/react-query   — 서버 상태 캐싱 + 자동 재요청
typescript              — 정적 타입 검사
```

---

## 프로젝트 구조

```
plant-counselor/
├── backend/
│   ├── app/
│   │   ├── ai/           # AI 엔진 (orchestrator, LLM client, 15 skills)
│   │   ├── auth/         # JWT 토큰
│   │   ├── db/models/    # ORM 모델 8개
│   │   ├── repositories/ # DB CRUD
│   │   ├── services/     # 비즈니스 로직
│   │   ├── schemas/      # Pydantic 스키마
│   │   ├── routers/      # FastAPI 엔드포인트 8개
│   │   └── scheduler/    # 10분 주기 자동 전이
│   ├── pyproject.toml    # 의존성 선언 (단일 출처)
│   ├── requirements.txt  # pyproject.toml 미러 (pip 직접 설치용)
│   ├── .env.example      # 환경변수 템플릿
│   ├── .env              # 실제 시크릿 (gitignore됨)
│   ├── .venv/            # 가상환경 (gitignore됨)
│   └── run.py            # uvicorn 진입점
├── frontend/
│   ├── app/              # Next.js App Router 페이지
│   ├── components/       # ChatPanel, Sidebar, NotificationsPopover
│   ├── lib/              # API client, Zustand stores, status utils
│   └── public/sprites/   # 픽셀아트 스프라이트
├── assets/sprites/       # 스프라이트 원본
├── scripts/              # 스프라이트 생성기 (generate_pixel_sprites.py)
├── ref_images/           # 디자인 레퍼런스 이미지
└── Plant-Counselor_Documents/
    └── MVP_Documents/    # 상세 문서 10편
```

---

## 핵심 흐름

```
사용자: "취업 식물 만들고 면접 준비 봉우리 추가해줘"
  ↓
AI: think → match_plant("취업") → create_plant("취업") → create_bud("면접 준비")
  ↓
정원에 식물+봉우리 즉시 표시, 통계 자동 갱신
```

---

## 문서

`Plant-Counselor_Documents`을 옵시디언에서 열어 마크다운 문서를 확인할 수 있습니다.

상세 문서는 [`Plant-Counselor_Documents/MVP_Documents/`](./Plant-Counselor_Documents/MVP_Documents/) 에 있습니다.

- [00 - 프로젝트 개요](./Plant-Counselor_Documents/MVP_Documents/00_Overview.md)
- [01 - 아키텍처](./Plant-Counselor_Documents/MVP_Documents/01_Architecture.md)
- [04 - AI 채팅 & 스킬](./Plant-Counselor_Documents/MVP_Documents/04_AI_Chat_And_Skills.md)
- [05 - 백엔드 코드 워크스루](./Plant-Counselor_Documents/MVP_Documents/05_Backend_Code_Walkthrough.md)
- [06 - API 레퍼런스](./Plant-Counselor_Documents/MVP_Documents/06_API_Reference.md)
- [08 - 운영](./Plant-Counselor_Documents/MVP_Documents/08_Operations.md)
- [09 - 전체 요약](./Plant-Counselor_Documents/MVP_Documents/09_Summary.md)

---

## 라이선스

Private project.
