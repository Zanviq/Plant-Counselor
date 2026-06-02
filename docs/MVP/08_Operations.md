# 08. Operations

## 1. 개발 환경 실행

### 백엔드
```bash
cd backend
python -m venv .venv && . .venv/Scripts/activate    # Windows
pip install -r pyproject.toml                       # 또는 pip install -e .
cp .env.example .env                                # 키 입력
python run.py
```
- 기본 포트 8000, hot reload ON.
- 헬스체크: `curl http://localhost:8000/health`

### 프론트엔드
```bash
cd frontend
pnpm install
pnpm dev
```
- 기본 포트 3000 (점유 시 3001로 fallback).
- `.env.local` 의 `NEXT_PUBLIC_API_BASE` 는 기본 `http://localhost:8000/api/v1`.

## 2. 환경 변수

| 키 | 기본값 | 비고 |
|----|--------|------|
| `DATABASE_URL` | `sqlite:///./plant_counselor.db` | prod엔 `postgresql+psycopg://...` |
| `JWT_SECRET` | `dev-secret` | **반드시 prod에서 교체** |
| `JWT_ACCESS_TTL` | `15` (분) | |
| `JWT_REFRESH_TTL` | `14` (일) | |
| `LLM_API_KEY` | `""` | 사용자별 키가 없을 때만 fallback. **개발 외엔 비워두는 게 안전** |
| `KEY_ENCRYPTION_SECRET` | `dev-encryption-key-32chars-padded` | **prod에서 교체 + 안전한 곳에 보관** |
| `CORS_ALLOW_ORIGIN` | `http://localhost:3000` | prod 도메인 |

## 3. 마이그레이션

```bash
cd backend
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

- 개발에서는 `Base.metadata.create_all` 이 lifespan에서 호출되어 별도 마이그레이션 없이도 시작 가능. 모델 수정만으로는 컬럼 추가가 sqlite에서 자동 반영되지 않으므로 변경 시 마이그레이션을 권장.

## 4. 로그

- AI 채팅 로그: `app/ai/log_store.py`가 저장/조회/삭제를 담당.
  - **저장**: Supabase `ai_logs` 테이블(정본) + `backend/logs/chat/*.json` 로컬 미러. 디스크가 휘발성인 호스트(Render 무료 등)에서도 재시작 후 로그가 살아남게 하기 위함.
  - **조회**(`list_rows`): DB 행 + 로컬 파일을 **filename 기준으로 병합·중복 제거(DB 우선)**. DB만/파일만/둘 다 어느 경우든 표시됨. 관리자 AI 로그 페이지·대시보드가 이 결과를 사용.
  - **테이블 생성**: `backend/migrations/002_ai_logs.sql`을 Supabase에 1회 실행(미실행 시 파일 폴백으로 동작).
  - ⚠ 이전 구현은 DB 조회 결과가 비어 있을 때 파일로 폴백하지 않아, 테이블이 비어 있으면 기존 파일 로그가 "로그 없음"으로 가려지던 버그가 있었음 → 병합 방식으로 수정.
- 표준 로그: stdout. uvicorn 기본 포맷.

## 5. 백업

- SQLite의 경우: `cp backend/plant_counselor.db ./backup/$(date +%Y%m%d).db`.
- Postgres: `pg_dump`.

## 6. 운영 체크리스트 (prod 전환 시)

1. `JWT_SECRET`, `KEY_ENCRYPTION_SECRET` 안전한 무작위 값으로 교체.
2. `DATABASE_URL` 을 관리형 Postgres로 전환.
3. `CORS_ALLOW_ORIGIN` 을 실제 도메인으로 고정.
4. HTTPS 종단 (nginx/Caddy) — refresh 쿠키 `Secure` 추가 권장 (현재 코드는 lax만 사용).
5. uvicorn workers ≥ 2, 모니터링 (헬스체크 `/health`).
6. APScheduler가 multi-worker에서 중복 실행되지 않도록 분산 락 또는 leader 지정 (현재 단일 노드 가정).
7. 채팅 로그 보존 정책 (예: 30일 이후 압축/삭제) 추가.
8. Gemini API 사용량 모니터링 및 quota 조정.

## 7. 자주 보는 명령

```bash
# 모든 채팅 로그를 최근 순으로 보기
ls -t backend/logs/chat | head

# DB 크기
ls -lh backend/plant_counselor.db

# 프론트 타입체크
cd frontend && npx tsc --noEmit

# 백엔드 모든 .py 구문 OK 확인
cd backend && python -c "import ast,glob; [ast.parse(open(f,encoding='utf-8').read()) for f in glob.glob('app/**/*.py',recursive=True)]; print('OK')"
```
