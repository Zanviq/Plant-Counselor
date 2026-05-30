# Plant Counselor 배포 가이드

프론트엔드(Next.js)는 Vercel, 백엔드(FastAPI)는 Render 또는 AWS에 배포한다.
세 컴포넌트(프론트, 백엔드, Supabase)가 서로의 주소를 알아야 하므로 순서가 중요하다.

작성 기준일: 2026-05-30

---

## 목차

- 0. 배포 구조 개요
- 1. 사전 준비 (공통)
- 2. 백엔드 배포 — 옵션 A: Render (권장, 무료)
- 3. 백엔드 배포 — 옵션 B: AWS (무료 티어)
- 4. 프론트엔드 배포 — Vercel (무료)
- 5. Supabase 설정 (인증 연결)
- 6. 배포 후 점검
- 7. 무료 플랜 주의사항과 한계
- 부록 A. 환경변수 전체 목록
- 부록 B. 자주 겪는 문제

---

## 0. 배포 구조 개요

이 프로젝트는 한 곳에 전부 올릴 수 없다. 백엔드가 상시 실행이 필요한 기능
(APScheduler 주기 작업, SSE 스트리밍 채팅, 로컬 파일 로그/백업)을 쓰기 때문에
서버리스(Vercel Functions)에 맞지 않는다. 따라서 다음과 같이 나눈다.

- 프론트엔드 (frontend/, Next.js 16) → Vercel
- 백엔드 (backend/, FastAPI) → Render 또는 AWS (상시 실행)
- 데이터베이스 / 인증 → Supabase (이미 사용 중)

연결 관계:
- 프론트엔드는 `NEXT_PUBLIC_API_BASE`로 백엔드 주소를 가리킨다.
- 백엔드는 `CORS_ALLOW_ORIGIN`으로 프론트엔드 주소만 허용한다.
- 프론트엔드/백엔드 모두 Supabase URL과 키를 사용한다.

배포 순서: 백엔드 먼저 → 프론트엔드 → Supabase 리다이렉트 설정 → 점검.

---

## 1. 사전 준비 (공통)

1. GitHub에 코드가 푸시되어 있어야 한다 (Vercel/Render가 레포를 연결한다).
2. Supabase 프로젝트의 다음 값을 미리 확보한다 (대시보드 → Settings → API).
   - Project URL: `https://<project-ref>.supabase.co`
   - anon public key (프론트용)
   - service_role key (백엔드용, 비공개)
   - JWT Secret (Legacy) — 백엔드 JWT 검증용
3. Google AI Studio에서 발급한 Gemini API 키 (`LLM_API_KEY`).
4. API 키 암호화용 32자 이상 랜덤 문자열 (`KEY_ENCRYPTION_SECRET`).
   - 예: `python -c "import secrets; print(secrets.token_urlsafe(32))"`

의존성 매니페스트는 이미 실제 코드에 맞게 정리되어 있다.
- 백엔드: `backend/requirements.txt` (supabase-py 기반, SQLAlchemy/psycopg2 없음)
- 프론트엔드: `frontend/package.json`

---

## 2. 백엔드 배포 — 옵션 A: Render (권장, 무료)

Render는 GitHub 레포를 연결해 Python 웹 서비스를 무료로 띄울 수 있어 가장 간단하다.

### 2.1 서비스 생성

1. https://render.com 가입 후 New → Web Service
2. GitHub 레포 연결, 이 프로젝트 선택
3. 설정값:
   - Root Directory: `backend`
   - Runtime: Python 3
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
     - 주의: 로컬 개발용 `python run.py`는 포트 8000 고정 + reload라 프로덕션에
       부적합하다. 반드시 위 uvicorn 명령으로 `$PORT`를 사용한다.
   - Instance Type: Free

### 2.2 Python 버전 고정 (선택, 권장)

`backend/` 에 `runtime.txt` 또는 환경변수로 Python 3.11+ 를 지정한다.
- 환경변수 방식: `PYTHON_VERSION = 3.11.9`
- 코드 요구사항: `requires-python = ">=3.11"` (pyproject.toml)

### 2.3 환경변수 설정 (Render 대시보드 → Environment)

부록 A의 백엔드 변수 전체를 입력한다. 핵심:
- `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`
- `LLM_API_KEY`, `KEY_ENCRYPTION_SECRET`
- `CORS_ALLOW_ORIGIN` = (4번에서 만들 Vercel 주소. 처음엔 비워두고 프론트 배포
  후 채워도 된다. 단 채우기 전까지 브라우저 요청이 CORS로 막힌다.)
- `DATABASE_URL` 은 현재 코드에서 실제 DB 연결에 사용하지 않으므로 비워도 되지만,
  설정 클래스 기본값이 있으니 그대로 두어도 무방하다.

### 2.4 배포 및 URL 확보

배포가 끝나면 `https://<서비스명>.onrender.com` 형태의 URL이 생긴다.
헬스 체크: 브라우저에서 `https://<서비스명>.onrender.com/health` → `{"status":"ok"}`

### 2.5 Render 무료 플랜 핵심 한계

- 약 15분간 요청이 없으면 인스턴스가 잠든다(cold start). 다음 요청 때 다시 깨어나는
  데 수십 초가 걸려 첫 응답이 느리다.
- 디스크가 휘발성이다. 재배포·재시작 시 `backend/logs/`(AI 로그)와
  `backend/backups/`(데이터 백업 ZIP)가 사라진다. 영구 보관이 필요하면 유료 디스크가
  필요하다. 단, 실제 데이터(식물/봉우리/일정/대화)는 Supabase에 있으므로 안전하다.
- 잠든 동안에는 APScheduler 전이 스캔도 멈춘다. 데모/소규모에는 문제없으나, 항상
  도는 스케줄러가 필요하면 유료 플랜이나 별도 cron이 필요하다.

---

## 3. 백엔드 배포 — 옵션 B: AWS (무료 티어)

AWS는 무료 티어로 12개월간 EC2 t2.micro/t3.micro 1대를 쓸 수 있다. Render보다 손이
많이 가지만 상시 실행(슬립 없음)이 장점이다. EC2에 직접 띄우는 방법을 설명한다.

### 3.1 EC2 인스턴스 생성

1. AWS 콘솔 → EC2 → Launch Instance
2. AMI: Ubuntu Server 22.04 LTS (또는 24.04)
3. Instance Type: t2.micro 또는 t3.micro (프리 티어 대상)
4. Key pair 생성/선택 (SSH 접속용 .pem)
5. Security Group (방화벽) 인바운드 규칙:
   - SSH (22) — 본인 IP만
   - Custom TCP (8000) — 0.0.0.0/0 (백엔드 포트. HTTPS를 붙이려면 80/443도 개방)
6. 인스턴스 시작 후 퍼블릭 IP/도메인 확보

### 3.2 서버 환경 구성 (SSH 접속 후)

```bash
sudo apt update && sudo apt install -y python3-venv python3-pip git
git clone <레포 URL> plant-counselor
cd plant-counselor/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3.3 환경변수 설정

`backend/.env` 파일을 생성하고 부록 A의 백엔드 변수를 채운다 (`.env.example` 참고).
`CORS_ALLOW_ORIGIN`은 Vercel 주소로 설정한다.

### 3.4 상시 실행 (systemd 서비스)

`/etc/systemd/system/plant-counselor.service` 작성:

```ini
[Unit]
Description=Plant Counselor API
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/plant-counselor/backend
ExecStart=/home/ubuntu/plant-counselor/backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

적용:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now plant-counselor
sudo systemctl status plant-counselor
```

이제 `http://<EC2 퍼블릭 IP>:8000/health` 로 확인 가능하다.

### 3.5 HTTPS (권장)

브라우저(HTTPS인 Vercel)에서 HTTP 백엔드를 호출하면 혼합 콘텐츠로 차단된다.
따라서 백엔드도 HTTPS가 필요하다. 방법:
- 도메인이 있으면 Nginx 리버스 프록시 + Let's Encrypt(certbot)로 인증서 발급.
- 도메인이 없으면 Caddy(자동 HTTPS) 사용 또는 무료 도메인 + certbot.
- 이 설정이 부담되면 Render(옵션 A)가 HTTPS를 자동 제공하므로 더 쉽다.

### 3.6 AWS 프리 티어 주의

- 12개월 후 과금된다. t2.micro도 24시간 가동 시 프리 티어 한도(월 750시간)는 1대
  기준 충족하지만, 트래픽/EBS 용량 초과 시 비용이 발생할 수 있다.
- 인스턴스 재시작 시 퍼블릭 IP가 바뀐다(Elastic IP를 할당하면 고정). IP가 바뀌면
  프론트의 `NEXT_PUBLIC_API_BASE`도 갱신해야 한다.

---

## 4. 프론트엔드 배포 — Vercel (무료)

### 4.1 프로젝트 import

1. https://vercel.com 가입 후 Add New → Project
2. GitHub 레포 선택
3. 설정:
   - Root Directory: `frontend` (모노레포이므로 반드시 지정)
   - Framework Preset: Next.js (자동 감지)
   - Build/Install: 기본값 (pnpm은 lockfile로 자동 감지)

### 4.2 환경변수 설정 (Vercel → Settings → Environment Variables)

- `NEXT_PUBLIC_SUPABASE_URL` = `https://<project-ref>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon public key
- `NEXT_PUBLIC_API_BASE` = 백엔드 주소 + `/api/v1`
  - Render 예: `https://plant-counselor-api.onrender.com/api/v1`
  - AWS 예: `https://api.example.com/api/v1` (HTTPS 필수)

`NEXT_PUBLIC_` 변수는 빌드 시점에 번들에 포함되므로, 값을 바꾸면 재배포가 필요하다.

### 4.3 배포 및 도메인 확보

배포가 끝나면 `https://<프로젝트명>.vercel.app` 도메인이 생긴다. 이 주소를:
- 백엔드 `CORS_ALLOW_ORIGIN`에 입력 (2.3 또는 3.3)
- Supabase 리다이렉트 허용 목록에 추가 (5번)

`CORS_ALLOW_ORIGIN`을 바꿨다면 백엔드를 재시작/재배포해야 반영된다.

---

## 5. Supabase 설정 (인증 연결)

프로덕션 도메인에서 Google 로그인이 동작하려면 Supabase에 도메인을 등록해야 한다.

1. Supabase 대시보드 → Authentication → URL Configuration
   - Site URL: `https://<프로젝트명>.vercel.app`
   - Redirect URLs에 추가: `https://<프로젝트명>.vercel.app/**`
     (로컬 개발도 병행하면 `http://localhost:3000/**` 도 함께 둔다.)
2. Google OAuth 리다이렉트 URI는 기존대로 유지:
   `https://<project-ref>.supabase.co/auth/v1/callback`
   (이 값은 Supabase가 처리하므로 변경하지 않는다.)
3. Authentication → Providers → Google이 활성화되어 있는지 확인.

---

## 6. 배포 후 점검

순서대로 확인한다.

1. 백엔드 헬스: `https://<백엔드>/health` → `{"status":"ok"}`
2. 프론트 접속: `https://<프로젝트명>.vercel.app` → 랜딩 페이지 표시
3. 로그인: Google 로그인 → `/home` 진입 (관리자면 `/admin`)
   - 실패 시 5번 Supabase 리다이렉트 설정 확인.
4. API 연결: 홈/정원에서 데이터 로드 확인
   - 네트워크 오류나 CORS 오류면 `NEXT_PUBLIC_API_BASE`(프론트)와
     `CORS_ALLOW_ORIGIN`(백엔드)이 서로 정확히 맞는지 확인.
5. AI 채팅: 식물 생성 발화 → SSE 응답 스트리밍 확인
   - Render 무료는 cold start로 첫 응답이 느릴 수 있다.

---

## 7. 무료 플랜 주의사항과 한계

- Render 무료: 비활성 시 슬립 → cold start 지연. 슬립 중 스케줄러 정지. 디스크 휘발
  (로그/백업 ZIP 소실, 단 Supabase의 실데이터는 안전).
- AWS 프리 티어: 12개월 한정, 이후 과금. 직접 HTTPS/프로세스 관리 필요. 재시작 시 IP
  변동(Elastic IP로 고정 가능).
- Vercel 무료(Hobby): 개인/비상업용. SSR/함수 시간 제한이 있으나 이 앱의 프론트는
  대부분 클라이언트 렌더라 영향이 적다.
- 공통: 데이터의 단일 진실 공급원은 Supabase다. 백엔드 호스트가 바뀌거나 초기화돼도
  식물/봉우리/일정/대화 데이터는 유지된다. 백엔드 로컬 파일(AI 로그, 백업 ZIP)만
  휘발 대상이다.

---

## 부록 A. 환경변수 전체 목록

### 백엔드 (Render Environment 또는 EC2 `backend/.env`)

| 변수 | 필수 | 설명 |
| --- | --- | --- |
| `SUPABASE_URL` | 필수 | `https://<project-ref>.supabase.co` |
| `SUPABASE_JWT_SECRET` | 필수 | JWT 검증용 (Settings → API → JWT Secret Legacy) |
| `SUPABASE_SERVICE_ROLE_KEY` | 필수 | DB 접근용 service_role 키 (비공개) |
| `LLM_API_KEY` | 필수 | Gemini API 키 (사용자별 키의 fallback) |
| `KEY_ENCRYPTION_SECRET` | 필수 | 사용자 API 키 암호화 (32자 이상) |
| `CORS_ALLOW_ORIGIN` | 필수 | 프론트 주소 (예: `https://xxx.vercel.app`) |
| `DATABASE_URL` | 선택 | 현재 실제 연결에 미사용. 비워도 동작 |

### 프론트엔드 (Vercel Environment Variables)

| 변수 | 필수 | 설명 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 필수 | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 필수 | Supabase anon public 키 |
| `NEXT_PUBLIC_API_BASE` | 필수 | 백엔드 주소 + `/api/v1` |

---

## 부록 B. 자주 겪는 문제

- 로그인 후 즉시 로그아웃되거나 `/login`으로 튕김
  → Supabase Site URL / Redirect URLs에 Vercel 도메인이 없음 (5번).
- 화면은 뜨는데 데이터가 안 불러와지고 콘솔에 CORS 에러
  → 백엔드 `CORS_ALLOW_ORIGIN`이 프론트 주소와 불일치, 또는 백엔드 미재시작.
- "네트워크 오류: 서버에 연결할 수 없습니다"
  → `NEXT_PUBLIC_API_BASE`가 잘못됨(`/api/v1` 누락 등), 또는 백엔드가 슬립/다운.
- Mixed Content 차단 (HTTPS 프론트 → HTTP 백엔드)
  → 백엔드를 HTTPS로 서비스해야 함. Render는 자동, AWS는 직접 설정(3.5).
- `pip install` 실패 또는 `ModuleNotFoundError: supabase`
  → 구버전 requirements를 쓰는 경우. 현재 `backend/requirements.txt`는 supabase-py
    기준으로 정리됨. 빌드 환경의 Python이 3.11+ 인지 확인.
- 첫 AI 응답이 매우 느림
  → Render 무료 cold start. 인스턴스가 깨어나는 시간. 정상 동작이며 이후 빨라짐.
