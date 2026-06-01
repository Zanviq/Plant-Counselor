# Plant Counselor

> 고민, 목표, 일정을 식물의 생애주기로 표현하는 AI 정원사 웹 서비스.

사용자는 자연어로 식물과 봉우리를 관리한다. 식물은 분야 또는 카테고리이고, 봉우리는
구체적인 고민, 목표, 할 일이다. 단순 약속과 예약은 별도 캘린더 일정으로 저장한다.

## 주요 기능

- **AI 정원사 채팅**: Gemini ReAct 루프가 20개 스킬을 연속 호출하고 SSE로 응답한다.
- **4가지 채팅 스코프**: 전체, 식물, 봉우리, 캘린더 맥락을 분리한다.
- **식물과 봉우리 관리**: 생성, 수정, 삭제, 진행률, 마감일, 수확, 포기를 지원한다.
- **픽셀아트 정원**: 봉우리 수만큼 성장 레이어를 위로 쌓아 무한 성장을 표현한다.
- **캘린더**: 봉우리 마감일과 독립 일정을 월간 화면에 병합한다.
- **대화 기록과 알림**: 스코프별 기록, 시듦, 썩음, 마감 임박 알림을 제공한다.
- **테마**: light, dark, system 모드를 제공한다.
- **관리자 패널**: 사용자, AI 로그, 알림, 백업, 복원, 런타임 설정, SQL, 타임
  트래블을 관리한다.

## 기술 스택

| 계층 | 기술 |
| --- | --- |
| Frontend | Next.js 16.2.6, React 19.2.4, TypeScript, Tailwind CSS v4 |
| Frontend state | Zustand, TanStack Query v5 |
| Backend | FastAPI, Pydantic v2, APScheduler |
| Database | Supabase PostgreSQL, `supabase-py` PostgREST HTTP |
| Authentication | Supabase Auth Google OAuth, ES256 JWKS 검증, HS256 fallback |
| LLM | Google Gemini via `google-genai` |
| IDs | ULID |

백엔드는 SQLAlchemy와 psycopg2를 사용하지 않는다. 일반 CRUD는
`backend/app/db/supa.py`의 Supabase HTTP 클라이언트로 처리한다.

## 로컬 실행

### 요구 사항

- Python 3.11+
- Poetry
- Node.js 20+
- Supabase 프로젝트와 Google OAuth Provider
- Gemini API 키

### 백엔드

```bash
cd backend
poetry config virtualenvs.in-project true --local
poetry install
```

`backend/.env`를 직접 생성한다. 이 저장소에는 `.env.example`이 없다.

```dotenv
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_JWT_SECRET=...
SUPABASE_SERVICE_ROLE_KEY=...
LLM_API_KEY=...
KEY_ENCRYPTION_SECRET=...
CORS_ALLOW_ORIGIN=http://localhost:3000
```

`DATABASE_URL`은 과거 호환 설명을 위해 남아 있지만 일반 CRUD에는 사용하지 않는다.

```bash
poetry run python run.py
```

- API: [http://localhost:8000](http://localhost:8000)
- OpenAPI: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health check: [http://localhost:8000/health](http://localhost:8000/health)

### 프론트엔드

```bash
cd frontend
npm install
```

`frontend/.env.local`을 생성한다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_BASE=http://localhost:8000/api/v1
```

```bash
npm run dev
```

웹 앱은 [http://localhost:3000](http://localhost:3000)에서 열린다.

## 검증

```bash
cd backend
poetry run python -m compileall app

cd ../frontend
npm run lint
npm run build
```

`npm run lint`는 기존 프론트엔드 코드에 알려진 기준선 오류가 있다. 변경 파일에서 새
오류를 추가하지 않았는지 함께 확인한다.

## 문서

- [AGENTS.md](./AGENTS.md): 현재 코드 기준 작업 가이드. 후속 작업자는 먼저 읽는다.
- [docs/README.md](./docs/README.md): 최신 문서와 역사 자료의 구분.
- [docs/DEMO_GUIDE.md](./docs/DEMO_GUIDE.md): 기능별 수동 회귀 시나리오.
- [docs/DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md): Render, Vercel, Supabase 배포.
- [CLAUDE.md](./CLAUDE.md): 과거 세션 변경 이력. 현재 상태 판단은 `AGENTS.md`를
  우선한다.

## 비밀값 주의

`backend/.env`, `frontend/.env.local`, 배포용 로컬 env 파일과 실제 키를 커밋하지
않는다.
