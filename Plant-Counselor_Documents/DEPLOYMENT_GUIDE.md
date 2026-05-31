# Plant Counselor 배포 가이드 (해야할 일 중심)

백엔드(FastAPI) → **Render**, 프론트(Next.js) → **Vercel**, DB/인증 → **Supabase**(이미 사용 중).

배포 순서: **① 백엔드(Render) → ② 프론트(Vercel) → ③ Supabase 인증 URL → ④ CORS 연결 → ⑤ 점검**

> **실제 값(키)은 git에 안 올라가는 로컬 파일에 미리 채워뒀습니다.**
> 그대로 복사해서 붙여넣으면 됩니다.
> - 백엔드 → `backend/.env.render`
> - 프론트 → `frontend/.env.vercel`

---

## 준비물 (한 번만 확인)

- [ ] GitHub에 최신 코드 push 완료 (Render/Vercel이 레포를 연결함)
- [ ] Supabase 대시보드 접근 가능 (프로젝트 `mnqwrofidwotcsvsymnd`)
- [ ] 위의 두 로컬 파일(`.env.render`, `.env.vercel`)에 값이 채워져 있음 (이미 완료)

---

## ① 백엔드 → Render

### 해야할 일
1. https://render.com 가입 → **New → Blueprint**
2. 이 레포 선택 → Render가 루트의 **`render.yaml`** 을 읽어 서비스를 자동 생성
   (Root=`backend`, Build/Start/헬스체크/Python 3.11 전부 자동 설정됨)
3. 생성된 서비스 → **Environment** 탭에서 아래 6개 값 입력
   → **`backend/.env.render` 파일 내용을 그대로 복사**해서 넣으면 됨
4. **Deploy** → 끝나면 URL 확보: `https://plant-counselor-api.onrender.com`
   (이름이 겹치면 뒤에 접미사가 붙을 수 있음 — 실제 URL을 적어둘 것)
5. 헬스 체크: 브라우저로 `https://<백엔드>/health` → `{"status":"ok"}` 확인

> Blueprint 대신 수동 생성 시: New → Web Service, Root=`backend`,
> Build=`pip install -r requirements.txt`,
> Start=`uvicorn app.main:app --host 0.0.0.0 --port $PORT`, 헬스체크=`/health`.

### 백엔드 환경변수 (Render → Environment)

| 변수 | 값 출처 |
| --- | --- |
| `SUPABASE_URL` | `https://mnqwrofidwotcsvsymnd.supabase.co` |
| `SUPABASE_JWT_SECRET` | Supabase → Settings → API → **JWT Secret (Legacy)** |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → **service_role** (비공개) |
| `LLM_API_KEY` | Google AI Studio Gemini 키 |
| `KEY_ENCRYPTION_SECRET` | 32자 이상 랜덤 문자열 (기존 값 유지 권장) |
| `CORS_ALLOW_ORIGIN` | ②에서 만들 Vercel 주소 (지금은 일단 비우거나 localhost) |

→ **실값은 `backend/.env.render`에 전부 채워져 있음. 그걸 복사.**
(`CORS_ALLOW_ORIGIN`만 ② 이후 실제 Vercel 주소로 갱신 — ④ 단계)

---

## ② 프론트 → Vercel

### 해야할 일
1. https://vercel.com 가입 → **Add New → Project** → 이 레포 선택
2. **Root Directory = `frontend`** 로 지정 (모노레포라 필수). 나머지는 자동 감지(Next.js)
3. **Environment Variables** 에 아래 3개 입력
   → **`frontend/.env.vercel` 파일 내용을 그대로 복사**
   (`NEXT_PUBLIC_API_BASE`는 ①에서 확보한 실제 Render URL + `/api/v1` 인지 확인)
4. **Deploy** → 끝나면 `https://<프로젝트>.vercel.app` 주소 확보

### 프론트 환경변수 (Vercel → Settings → Environment Variables)

| 변수 | 값 |
| --- | --- |
| `NEXT_PUBLIC_API_BASE` | `https://<백엔드>.onrender.com/api/v1` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://mnqwrofidwotcsvsymnd.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → **anon public** |

> `NEXT_PUBLIC_*` 는 빌드에 박히므로 **값을 바꾸면 반드시 재배포**해야 반영됨.

---

## ③ Supabase 인증 URL 등록

Supabase 대시보드 → **Authentication → URL Configuration**

- [ ] **Site URL** = `https://<프로젝트>.vercel.app`
- [ ] **Redirect URLs** 에 추가: `https://<프로젝트>.vercel.app/**`
      (로컬도 쓰면 `http://localhost:3000/**` 도 함께 둠)
- [ ] Authentication → Providers → **Google 활성화** 확인

> Google OAuth 콜백 `https://mnqwrofidwotcsvsymnd.supabase.co/auth/v1/callback` 은 그대로 둠.

---

## ④ CORS 연결 마무리 (백엔드 ↔ 프론트)

- [ ] Render → Environment → `CORS_ALLOW_ORIGIN` 를 실제 Vercel 주소로 설정
      (로컬 병행 시 콤마로: `http://localhost:3000,https://<프로젝트>.vercel.app`)
- [ ] 저장하면 Render가 자동 재배포 → 반영됨

---

## ⑤ 점검 체크리스트

- [ ] `https://<백엔드>/health` → `{"status":"ok"}`
- [ ] `https://<프로젝트>.vercel.app` → 랜딩 페이지
- [ ] Google 로그인 → `/home` 진입 (관리자면 `/admin`)
      실패 → ③ Redirect URLs 확인
- [ ] 홈/정원 데이터 로드됨
      CORS/네트워크 오류 → ④ `CORS_ALLOW_ORIGIN` ↔ `NEXT_PUBLIC_API_BASE` 일치 확인
- [ ] AI 채팅 식물 생성 → 스트리밍 응답
      첫 응답 느림 = Render 무료 cold start(정상)

---

## 자주 겪는 문제

| 증상 | 원인 / 해결 |
| --- | --- |
| 로그인 후 `/login`으로 튕김 | ③ Site URL / Redirect URLs에 Vercel 도메인 없음 |
| 데이터 안 뜨고 콘솔 CORS 에러 | `CORS_ALLOW_ORIGIN` ≠ 프론트 주소, 또는 백엔드 미재배포 (④) |
| "서버에 연결할 수 없습니다" | `NEXT_PUBLIC_API_BASE` 오타(`/api/v1` 누락) 또는 백엔드 슬립 |
| Mixed Content 차단 | HTTPS 프론트 → HTTP 백엔드. Render는 HTTPS 자동이라 보통 발생 안 함 |
| `ModuleNotFoundError: supabase` | Python 3.11+ 인지 확인 (`render.yaml`이 3.11.9 고정) |
| 첫 AI 응답 매우 느림 | Render 무료 cold start. 깨어난 뒤엔 정상 |

---

## 무료 플랜 한계 (알아둘 것)

- **Render 무료**: 15분 무요청 시 슬립 → 첫 요청 cold start 지연. 슬립 중 APScheduler 전이 스캔도 멈춤.
- **휘발성 디스크**: 재배포/재시작 시 `backend/logs/`(AI 로그), `backend/backups/`(백업 ZIP) 소실.
  단, **실데이터(식물/봉우리/일정/대화)는 Supabase에 있어 안전**.
- **Vercel 무료(Hobby)**: 개인/비상업용. 이 앱 프론트는 대부분 클라이언트 렌더라 영향 적음.

---

## 환경변수 레퍼런스 (요약)

| 위치 | 변수 |
| --- | --- |
| **Render (백엔드)** | `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `LLM_API_KEY`, `KEY_ENCRYPTION_SECRET`, `CORS_ALLOW_ORIGIN` |
| **Vercel (프론트)** | `NEXT_PUBLIC_API_BASE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

> 실제 값 = 로컬 전용(git 미포함) `backend/.env.render`, `frontend/.env.vercel`.
> `DATABASE_URL`은 런타임에서 안 쓰므로 설정 불필요(생략 가능).
