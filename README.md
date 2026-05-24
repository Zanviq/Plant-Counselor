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

| 계층 | 기술 |
|------|------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind v4, Zustand, TanStack Query |
| Backend | FastAPI, SQLAlchemy 2.x, Pydantic v2, APScheduler |
| LLM | Google Gemini 2.5 Flash |
| DB | SQLite (dev) / PostgreSQL (prod) |
| Auth | JWT + Argon2 + Fernet |

## 빠른 시작

### 요구 사항

- Python 3.11+
- Node.js 20+ / pnpm
- Gemini API 키 ([Google AI Studio](https://aistudio.google.com/)에서 발급)

### 백엔드

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# Mac/Linux: source .venv/bin/activate
pip install -e .
cp .env.example .env    # LLM_API_KEY, JWT_SECRET 등 입력
python run.py           # http://localhost:8000
```

### 프론트엔드

```bash
cd frontend
pnpm install
pnpm dev                # http://localhost:3000
```

### 스프라이트 재생성 (선택)

```bash
pip install Pillow
python scripts/generate_pixel_sprites.py
cp assets/sprites/* frontend/public/sprites/
```

## 환경 변수

`backend/.env` 파일에 설정합니다.

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `DATABASE_URL` | `sqlite:///./plant_counselor.db` | DB 연결 문자열 |
| `JWT_SECRET` | `dev-secret` | JWT 서명 시크릿 (**prod에서 반드시 교체**) |
| `JWT_ACCESS_TTL` | `15` | 액세스 토큰 유효시간 (분) |
| `JWT_REFRESH_TTL` | `14` | 리프레시 토큰 유효시간 (일) |
| `LLM_API_KEY` | — | Gemini API 키 (사용자별 키의 fallback) |
| `KEY_ENCRYPTION_SECRET` | `dev-encryption-...` | 사용자 API 키 암호화 시크릿 |
| `CORS_ALLOW_ORIGIN` | `http://localhost:3000` | 프론트엔드 도메인 |

## 프로젝트 구조

```
plant-counselor/
├── backend/
│   ├── app/
│   │   ├── ai/           # AI 엔진 (orchestrator, LLM client, 15 skills)
│   │   ├── auth/          # JWT 토큰
│   │   ├── db/models/     # ORM 모델 8개
│   │   ├── repositories/  # DB CRUD
│   │   ├── services/      # 비즈니스 로직
│   │   ├── schemas/       # Pydantic 스키마
│   │   ├── routers/       # FastAPI 엔드포인트 8개
│   │   └── scheduler/     # 10분 주기 자동 전이
│   └── run.py
├── frontend/
│   ├── app/               # Next.js App Router 페이지
│   ├── components/        # ChatPanel, Sidebar, NotificationsPopover
│   ├── lib/               # API client, Zustand stores, status utils
│   └── public/sprites/    # 픽셀아트 스프라이트
├── assets/sprites/        # 스프라이트 원본
├── scripts/               # 스프라이트 생성기
├── ref_images/            # 디자인 레퍼런스
└── Plant-Counselor_Documents/
    └── MVP_Documents/     # 상세 문서 10편
```

## 핵심 흐름

```
사용자: "취업 식물 만들고 면접 준비 봉우리 추가해줘"
  ↓
AI: think → match_plant("취업") → create_plant("취업") → create_bud("면접 준비")
  ↓
정원에 식물+봉우리 즉시 표시, 통계 자동 갱신
```

## 문서

상세 문서는 [`Plant-Counselor_Documents/MVP_Documents/`](./Plant-Counselor_Documents/MVP_Documents/) 에 있습니다.

- [00 - 프로젝트 개요](./Plant-Counselor_Documents/MVP_Documents/00_Overview.md)
- [04 - AI 채팅 & 스킬](./Plant-Counselor_Documents/MVP_Documents/04_AI_Chat_And_Skills.md)
- [05 - 백엔드 코드 워크스루](./Plant-Counselor_Documents/MVP_Documents/05_Backend_Code_Walkthrough.md)
- [09 - 전체 요약](./Plant-Counselor_Documents/MVP_Documents/09_Summary.md)

## 라이선스

Private project.
