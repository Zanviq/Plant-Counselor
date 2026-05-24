# Plant Counselor MVP — 프로젝트 개요

## 1. 한 줄 정의

> **"고민과 일정을 식물 생애주기에 비유해 함께 가꾸는 AI 정원사."**

사용자가 자연어로 고민·일정·할 일을 말하면 AI 정원사가 이를 **식물(Plant)** 과 **봉우리(Bud)** 의 메타포로 시각화·관리합니다. 봉우리는 씨앗에서 시작하여 성장하고, 결실을 맺어 수확하거나, 방치되면 시들고 썩습니다.

---

## 2. 핵심 모델

| 개념 | 역할 | 예시 |
|------|------|------|
| **식물 (Plant)** | 분야·카테고리 컨테이너 | "취업", "동아리", "운동", "일상" |
| **봉우리 (Bud)** | 식물에 속한 구체적 고민·일정·할 일 | "면접 준비", "도호랑 밥먹기", "주 3회 운동" |
| **상태 (Status)** | 봉우리의 생애주기 7단계 | seed → bud → flower → fruit → harvested / wilting → rot |
| **진행률 (Progress)** | 0~100%, 자동 상태 전이 트리거 | 30% → bud, 60% → flower, 85% → fruit |
| **타입 (Type)** | 봉우리의 성격 구분 | concern(고민/걱정) / schedule(일정/할일/약속) |

### 상태 전이 규칙

```
                  ┌─────────┐
                  │  seed   │ (0~29%)
                  └────┬────┘
                       │ 진행률 30%+
                  ┌────▼────┐
                  │   bud   │ (30~59%)
                  └────┬────┘
                       │ 진행률 60%+
                  ┌────▼────┐
                  │ flower  │ (60~84%)
                  └────┬────┘
                       │ 진행률 85%+
                  ┌────▼────┐
                  │  fruit  │ (85~100%)
                  └────┬────┘
                       │ harvest_bud 스킬
                  ┌────▼────┐
                  │harvested│ ── 수확 완료!
                  └─────────┘

  (N일 활동 없음)        (N일 추가 방치)
  ┌─────────┐            ┌──────┐
  │ wilting │ ──────────▶ │ rot  │ ── 썩음
  └─────────┘            └──────┘
```

- **자동 전이**: `garden_rules.wilting_days`(기본 7일) 동안 진행 없으면 wilting, 추가 `rot_disappear_days`(14일) 후 rot
- **수동 전이**: `update_bud_status` 스킬로 직접 변경 가능
- **진행률 기반 전이**: `update_bud_progress` 호출 시 30/60/85% 임계에서 자동 승격
- **수확**: `harvest_bud`로 완료 처리 → harvested 상태
- **포기**: `abandon_bud`로 포기 → rot 상태

---

## 3. MVP 기능 목록

### 3.1 인증 시스템
- 닉네임/비밀번호 가입·로그인
- JWT 액세스 토큰(15분) + HTTP-only 쿠키 리프레시 토큰(14일)
- 401 시 자동 refresh → 재시도 (사용자에게 끊김 없음)
- 비밀번호 변경, 계정 삭제(닉네임 재입력 확인)

### 3.2 식물(Plant) 관리
- AI 대화로 식물 생성 (분야 자동 추론 + 중복 검사)
- 정원 페이지: **그래픽 뷰**(픽셀아트 스프라이트 + 가로 스크롤 캐러셀) + **리스트 뷰**(검색/정렬)
- 식물 상세: 통계(활성/수확/포기) + 봉우리 목록(필터) + 삭제(2단계 확인)

### 3.3 봉우리(Bud) 관리
- AI 대화로 봉우리 생성 (고민/일정 자동 구분, 마감일 자동 설정)
- 봉우리 드로어: 진행률 바·메타정보·상태 변경 이력
- 빠른 액션: +20% / 수확 / 포기 버튼 (AI 자동 호출)
- 가지 끝에 봉우리 스프라이트로 시각화, hover 시 이름 표시

### 3.4 AI 정원사 채팅
- **ReAct 멀티스텝 루프**: 한 번의 발화로 여러 스킬 연속 실행 (최대 10스텝)
- **15개 스킬**: think, match_plant, create_plant, delete_plant, create_bud, update_bud_status, update_bud_progress, set_deadline, abandon_bud, harvest_bud, list_plants, list_buds, get_statistics, get_garden_briefing, search_conversation
- **4가지 대화 스코프**: 전체(global), 식물(plant), 봉우리(bud), 캘린더(calendar)
- **7가지 명령어**: /clear, /compact, /plants, /new, /settings, /skills, /use
- **스킬 실행 후 자동 캐시 갱신**: 식물/봉우리/통계/캘린더 쿼리 자동 무효화
- SSE 실시간 스트리밍 (토큰 단위)

### 3.5 캘린더 & 일정
- 월별 그리드 캘린더 (이벤트 도트, 선택일 상세)
- 이벤트에 식물 이름·시간(detail)·타입(일정/고민) 표시
- 캘린더 전용 채팅 세션 ("일정 AI와 대화" 버튼)
- AI 일일 브리핑 (캐시, 하루 1회 생성)
- 일정 생성 시 AI가 식물 자동 매칭·생성 (질문 없이)

### 3.6 알림
- 시들·썩음·마감 임박 자동 알림 (10분 주기 스케줄러)
- 사이드바 배지 + 팝오버 (읽음/모두읽음)

### 3.7 테마 시스템
- **3가지 모드**: light / dark / system (OS 추종)
- **4가지 강조색**: emerald(기본) / sapphire / violet / sunset
- **Pre-hydration**: `theme-init.js`로 첫 페인트 깜빡임 방지
- **Persist**: localStorage에 저장, 새로고침 후에도 유지

### 3.8 설정
- 계정: 닉네임 표시, 비밀번호 변경, 로그아웃
- AI: Gemini API 키 (Fernet 암호화 저장), 응답 톤 3종
- 정원 규칙: 시듦 기준 일수, 썩음 일수, 마감 알림 기준 (NumberStepper)
- 테마: 모드 + 강조색 (시각적 프리뷰 카드)
- 정보: 버전, 데이터 정책

---

## 4. 기술 스택

| 계층 | 기술 |
|------|------|
| 프론트엔드 | Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind v4, Zustand, TanStack Query |
| 백엔드 | FastAPI, SQLAlchemy 2.x (Mapped types), Pydantic v2, APScheduler |
| DB | SQLite (개발) — Postgres 등으로 교체 가능 |
| LLM | Google Gemini 2.5 Flash (`google-genai` SDK) |
| 인증 | JWT (python-jose), Argon2 비밀번호 해시, Fernet API 키 암호화 |
| 스프라이트 | Python Pillow — 자동 생성·crop·좌표 매핑 |

---

## 5. 디렉터리 구조

```
plant-counselor/
├── backend/
│   ├── app/
│   │   ├── ai/                    ─ AI 엔진
│   │   │   ├── chat_orchestrator.py  ─ ReAct 루프 + SSE 스트리밍
│   │   │   ├── llm_client.py         ─ Gemini SDK 어댑터
│   │   │   ├── prompt_builder.py     ─ 시스템 프롬프트 조립
│   │   │   ├── skill_base.py         ─ Skill 추상 베이스
│   │   │   ├── skill_registry.py     ─ 스킬 등록·디스패치
│   │   │   ├── log_recorder.py       ─ 채팅 JSON 로그
│   │   │   └── skills/               ─ 15개 스킬 모듈
│   │   ├── auth/jwt.py            ─ JWT 토큰 생성·검증
│   │   ├── db/
│   │   │   ├── base.py               ─ SQLAlchemy DeclarativeBase
│   │   │   ├── session.py            ─ Engine + SessionLocal
│   │   │   └── models/               ─ ORM 모델 8개
│   │   ├── repositories/          ─ DB CRUD (6개)
│   │   ├── services/              ─ 비즈니스 로직 (6개)
│   │   ├── schemas/               ─ Pydantic 스키마
│   │   ├── routers/               ─ FastAPI 엔드포인트 (8개)
│   │   ├── scheduler/jobs.py      ─ 10분 주기 봉우리 자동 전이
│   │   ├── config.py              ─ 환경설정 (.env)
│   │   ├── deps.py                ─ get_db + require_user
│   │   └── main.py                ─ FastAPI 앱 진입점
│   ├── alembic/                   ─ DB 마이그레이션
│   ├── logs/chat/                 ─ 채팅 디버그 로그 (JSON)
│   └── run.py                     ─ uvicorn 실행
├── frontend/
│   ├── app/
│   │   ├── layout.tsx + providers.tsx   ─ 루트 레이아웃 + 테마 부트스트랩
│   │   ├── globals.css                 ─ 디자인 토큰 + 컴포넌트 프리미티브
│   │   ├── (auth)/login/page.tsx       ─ 로그인/가입
│   │   └── (app)/
│   │       ├── layout.tsx              ─ 사이드바 + ChatPanel + FAB
│   │       ├── page.tsx                ─ 홈 (통계 + 식물 보드 + 시듦)
│   │       ├── plants/page.tsx         ─ 정원 (그래픽/리스트 토글)
│   │       ├── plants/[id]/page.tsx    ─ 식물 상세 + 봉우리 드로어
│   │       ├── calendar/page.tsx       ─ 캘린더 + 일정 관리
│   │       └── settings/page.tsx       ─ 설정 5탭
│   ├── components/
│   │   ├── chat/ChatPanel.tsx          ─ AI 채팅 패널 (SSE + 명령어)
│   │   └── layout/
│   │       ├── Sidebar.tsx             ─ 사이드바 (어두운 올리브)
│   │       └── NotificationsPopover.tsx ─ 알림 팝오버
│   ├── lib/
│   │   ├── api/                        ─ fetch 래퍼 + 도메인 함수
│   │   ├── store/                      ─ Zustand 스토어 3개
│   │   └── status.ts                   ─ 봉우리 상태 단일 소스
│   └── public/
│       ├── sprites/                    ─ 픽셀아트 스프라이트
│       └── theme-init.js              ─ Pre-hydration 테마
├── assets/sprites/                ─ 스프라이트 원본
├── scripts/
│   └── generate_pixel_sprites.py  ─ 스프라이트 생성기
├── ref_images/                    ─ 디자인 레퍼런스
└── Plant-Counselor_Documents/
    └── MVP_Documents/             ─ 이 문서 묶음
```

---

## 6. 문서 목차

| 번호 | 제목 | 무엇을 다루는가 |
|------|------|----------------|
| 00 | **이 문서** | 개요·모델·기능·스택·구조 |
| 01 | Architecture | 계층·요청 흐름·외부 통합·인증·스케줄러 |
| 02 | UI Pages & Components | 페이지/컴포넌트 상세 명세 |
| 03 | Theme System | 디자인 토큰·테마 전환·사용 가이드 |
| 04 | AI Chat & Skills | ReAct 루프·15개 스킬·프롬프트 설계·멀티스킬 |
| 05 | Backend Code Walkthrough | **모든 Python 파일/함수/변수/설계 이유** |
| 06 | API Reference | REST 엔드포인트 전체 명세 |
| 07 | System Test Plan | 시스템 테스트 케이스 60+ |
| 08 | Operations | 실행·환경변수·마이그레이션·운영 |
| 09 | Summary (요약) | 전체 요약 + 핵심 흐름 |
