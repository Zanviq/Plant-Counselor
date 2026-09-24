<div align="center">

# 🌱 Plant Counselor

**고민, 목표, 일정을 식물처럼 키워 주는 AI 정원사**

<!-- TODO: 라이선스 뱃지 — LICENSE 파일을 정한 뒤 추가 -->
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)

[English](./README.md) | **한국어**

<img src="https://img.shields.io/badge/Powered%20by-Google%20Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Powered by Gemini"/>

</div>

---

## 💭 Developer's Note

> *"모든 고민은 봉우리로 시작합니다. 꽃을 피울지 시들지는 얼마나 돌보느냐에 달려 있어요."*

<!-- TODO: 개발 동기 -->

---

## ✨ Features

### 🌿 식물과 봉우리
- **식물**은 삶의 분야(취업, 건강, 공부), **봉우리**는 그 안의 구체적인 고민·목표·추적할 일정입니다
- 봉우리는 `봉우리 → 꽃 → 열매 → 수확` 순서로 자라며, 진행률 60%에서 꽃, 85%에서 열매로 자동 전이합니다
- 수확은 진행률 100%일 때만 가능합니다. 규칙이 서비스 계층에 있어 AI도 우회할 수 없습니다
- 상태가 바뀔 때마다 이력 테이블에 기록되고 봉우리 상세 화면에 표시됩니다

### 🥀 시듦과 썩음
- APScheduler 작업이 10분마다 돌면서 진행이 없는 봉우리를 `시듦`, 이후 `썩음`으로 바꿉니다
- 기준은 사용자별 정원 규칙을 따릅니다 (기본값: 7일 뒤 시듦, 14일 뒤 썩음, 마감 3일 전 알림)
- 시듦·썩음·마감 임박 시 알림이 생성되며, 읽지 않은 같은 마감 알림은 중복 생성하지 않습니다

### 🤖 AI 정원사
- 자연어 요청을 Gemini ReAct 루프(최대 10단계)가 처리하고 `create_bud`, `update_bud_progress`, `create_calendar_event` 등 20개 스킬을 호출합니다
- 응답은 SSE(`start`, `tool_call`, `tool_result`, `token`, `done`)로 스트리밍됩니다
- 대화 범위는 전체·식물·봉우리·캘린더 4가지이며, 범위 밖 항목의 수정·삭제는 서버에서 막습니다
- Gemini API 키는 사용자가 직접 입력합니다. 브라우저에만 저장되고 요청마다 전달되며 서버에는 저장하지 않습니다

### 🖼️ 픽셀아트 정원
- 식물은 픽셀아트 스프라이트로 그려지며, 봉우리 상태에 따라 꽃·열매·색이 달라집니다
- 정원 화면은 확대/축소를 지원하고, 수확한 봉우리는 수확 바구니에 모입니다
- 같은 데이터를 리스트 보기로도 볼 수 있습니다

### 📅 캘린더
- 봉우리 마감일과 일반 일정을 한 달력에 합쳐 보여줍니다
- 일정은 시작/종료 시간, 하루 종일, 여러 날, 반복(매일~매년), 6가지 색상을 지원합니다
- 시간이 겹쳐도 저장은 되지만 충돌로 알려 주며, 일정을 다른 날로 드래그할 수 있습니다
- JSON, CSV, ICS로 내보낼 수 있습니다

### 🗂️ 대화 기록
- 대화는 범위별로 저장되고 대화 기록 화면에서 찾아보고 검색할 수 있습니다
- 채팅과 기록 화면은 하나의 Markdown 렌더러를 공유하며 `javascript:`/`data:` 링크를 막습니다

### 🛠️ 관리자 콘솔
- 사용자·권한 관리, 사용자별 AI 모델 지정, AI 로그 조회(프롬프트, LLM 호출, 스킬 호출, 오류)
- 알림 발송, ZIP 백업과 덮어쓰지 않는 복원, 런타임 설정, SQL 실행기
- 타임 트래블로 앱 시계를 옮겨 시듦·마감 규칙을 테스트할 수 있습니다

---

## 🚀 Getting Started

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) (Docker Compose 포함)
- (AI 채팅을 쓸 때만) [Google Gemini API 키](https://aistudio.google.com/apikey)

### 실행

```bash
git clone https://github.com/Zanviq/Plant-Counselor.git
cd Plant-Counselor
cp .env.example .env
docker compose up --build
```

- 웹 앱: http://localhost:3000
- API 문서: http://localhost:8000/docs

처음 시작할 때 백엔드가 Alembic 마이그레이션을 적용하고 데모 데이터를 넣습니다.

### 데모 계정

| 구분 | 아이디 | 비밀번호 |
|------|--------|----------|
| 사용자 | `demo` | `demo1234` |
| 관리자 | `admin` | `admin1234` |

### Gemini API 키

AI 채팅을 제외한 기능은 키 없이 동작합니다. AI 정원사를 쓰려면:

1. **설정 → AI**를 엽니다 (또는 AI 패널을 열면 보이는 키 입력 칸을 사용합니다)
2. [Google AI Studio](https://aistudio.google.com/apikey)에서 발급한 키를 붙여 넣고 **저장**을 누릅니다
3. 키는 이 브라우저의 `localStorage`에 저장되고, 채팅 요청에만 `X-Gemini-Api-Key` 헤더로 전달됩니다

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript |
| **State** | TanStack Query v5, Zustand |
| **Styling** | Tailwind CSS v4, CSS 변수 (라이트/다크) |
| **Backend** | FastAPI, Pydantic v2, APScheduler |
| **Database** | PostgreSQL 16, psycopg 3, Alembic |
| **Auth** | bcrypt 비밀번호 해시, httpOnly 쿠키의 HS256 JWT |
| **AI** | Google Gemini (`google-genai`) |
| **Infra** | Docker Compose (멀티스테이지 이미지) |

---

## 📁 Project Structure

```
plant-counselor/
├── 📂 backend/
│   ├── 📂 alembic/versions/     # SQL 마이그레이션 (스키마 기준본)
│   ├── 📂 app/
│   │   ├── 📂 ai/               # ReAct 오케스트레이터, Gemini 클라이언트, 프롬프트, 권한
│   │   │   └── 📂 skills/       # AI 스킬 20개
│   │   ├── 📂 db/
│   │   │   ├── pg.py            # psycopg 쿼리 빌더와 커넥션 풀
│   │   │   └── seed.py          # 데모 계정과 샘플 데이터
│   │   ├── 📂 repositories/     # SQL 접근, 항상 user_id로 필터링
│   │   ├── 📂 routers/          # 인증, 식물, 봉우리, 캘린더, 채팅, 관리자 ...
│   │   ├── 📂 services/         # 생애주기 규칙, 캘린더, 백업, 상태 전이
│   │   ├── 📂 scheduler/        # 시듦 / 썩음 / 마감 스캔 작업
│   │   ├── security.py          # bcrypt + 세션 쿠키
│   │   └── main.py              # FastAPI 앱과 CORS 래퍼
│   ├── docker-entrypoint.sh     # 마이그레이션 → seed → 서버 시작
│   └── Dockerfile
├── 📂 frontend/
│   ├── 📂 app/
│   │   ├── 📂 (app)/            # 홈, 정원, 캘린더, 대화 기록, 설정
│   │   ├── 📂 (auth)/login/     # 로그인과 회원가입
│   │   └── 📂 admin/            # 관리자 콘솔
│   ├── 📂 components/           # 채팅 패널, 정원 스프라이트, 사이드바
│   ├── 📂 lib/
│   │   ├── 📂 api/              # API 클라이언트와 SSE 스트림 수신
│   │   ├── geminiKey.ts         # 브라우저 전용 Gemini 키 저장
│   │   └── markdown.tsx         # 공용 Markdown 렌더러
│   └── Dockerfile
├── 📂 scripts/capture-screenshots/  # README 이미지용 Playwright 스크립트
├── 📂 image/                    # 스크린샷
├── docker-compose.yml
└── .env.example
```

---

## 💡 How to Use

1. **로그인**: `demo / demo1234`로 로그인하거나 회원가입 탭에서 계정을 만듭니다
2. **대시보드 확인**: 홈에서 진행 중인 고민·일정, 이번 달 수확, 돌봐야 할 봉우리를 봅니다
3. **AI 정원사에게 요청**: AI 버튼(또는 Space)을 누르고 "취업 준비에 '포트폴리오' 봉우리 추가해줘, 마감은 다음 주 금요일"처럼 입력합니다
4. **진행률 기록**: 식물 상세에서 봉우리를 열고 진행률 슬라이더를 움직입니다. 100%가 되면 수확합니다
5. **캘린더 계획**: **+ 일정 추가**로 일정을 만들거나 일정을 다른 날로 드래그합니다
6. **기록 돌아보기**: 대화 기록 화면에서 범위별 지난 대화를 검색합니다
7. **정원 규칙 조정**: **설정 → 정원 규칙**에서 시듦·마감 알림 기준을 바꿉니다

---

## 👥 Team

| 이름 | 역할 |
|------|------|
| confidencecat (Zanviq) | 프로젝트 총괄 제작 |
| studysnack | 프론트 제작 및 기능 보조 |

---

## 🎨 Screenshots

<div align="center">

![대시보드](image/dashboard.png)

<table>
  <tr>
    <td><img src="image/garden.png" width="400" alt="정원"/></td>
    <td><img src="image/plant-detail.png" width="400" alt="식물 상세"/></td>
  </tr>
  <tr>
    <td><img src="image/bud-detail.png" width="400" alt="봉우리 상세"/></td>
    <td><img src="image/calendar.png" width="400" alt="캘린더"/></td>
  </tr>
  <tr>
    <td><img src="image/ai-chat.png" width="400" alt="AI 채팅"/></td>
    <td><img src="image/history.png" width="400" alt="대화 기록"/></td>
  </tr>
  <tr>
    <td><img src="image/settings-api-key.png" width="400" alt="API 키 설정"/></td>
    <td><img src="image/ai-chat-no-key.png" width="400" alt="키 없는 AI 채팅"/></td>
  </tr>
  <tr>
    <td><img src="image/admin-dashboard.png" width="400" alt="관리자 대시보드"/></td>
    <td><img src="image/admin-ai-logs.png" width="400" alt="관리자 AI 로그"/></td>
  </tr>
  <tr>
    <td><img src="image/landing.png" width="400" alt="랜딩 페이지"/></td>
    <td><img src="image/login.png" width="400" alt="로그인"/></td>
  </tr>
</table>

<i>AI 채팅 스크린샷은 목 응답으로 채운 화면입니다.</i>

</div>

---

## 📝 License

<!-- TODO: 라이선스 결정 후 LICENSE 파일 추가 및 문구 작성 -->

---

<div align="center">

| 👤 **Developer** | ✉️ **Email** |
|:---:|:---:|
| Zanviq | zanviq.dev@gmail.com |

</div>
