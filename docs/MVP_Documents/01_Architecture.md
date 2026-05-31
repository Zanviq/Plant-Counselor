# 01. 아키텍처

## 1. 전체 그림

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Next.js 16)                    │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  Sidebar    │  │   ChatPanel  │  │  Pages (Home/...)  │  │
│  │  + popover  │  │   (SSE 수신)  │  │                    │  │
│  └─────┬───────┘  └──────┬───────┘  └─────────┬──────────┘  │
│        │ Zustand stores (auth, chat, theme)   │             │
│        └──────────────┬─────────────────────┬─┘             │
│                       ▼                     ▼               │
│                  TanStack Query        fetch wrapper        │
└─────────────────────────┬───────────────────┬───────────────┘
                          │ HTTPS / SSE       │ Bearer + Cookie
                          ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                  FastAPI Backend (uvicorn)                  │
│  Routers ─► Services ─► Repositories ─► SQLAlchemy ─► DB    │
│     │                                                       │
│     └─► /chat/message ─► ChatOrchestrator (ReAct loop)      │
│             │                    │                          │
│             ▼                    ▼                          │
│         LLMClient (Gemini)   SkillRegistry (15 skills)      │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
                Google Gemini API
```

## 2. 계층 (백엔드)

각 계층은 한 가지 책임만 갖습니다.

| 계층 | 역할 | 예시 |
|------|------|------|
| **Router** | HTTP I/O + 인증 + Pydantic 검증 | `plants.py`, `chat.py` |
| **Service** | 비즈니스 로직 + 트랜잭션 관리 | `PlantService.create()` 가 repo 호출 후 `db.commit()` |
| **Repository** | DB CRUD 단일 책임 (commit 하지 않음) | `PlantRepository.create()` 가 `db.flush()` 만 |
| **Model** | SQLAlchemy ORM 정의 + 인덱스 | `Plant`, `Bud`, `BudHistory` |
| **Schema** | API 입출력 Pydantic 모델 | `PlantOut`, `UserUpdate` |

### 트랜잭션 정책

- **Repository는 `flush()` 만**, `commit()` 은 Service가 책임진다.
- 이유: 하나의 사용자 요청에서 여러 repo를 묶어야 할 때 (예: 봉우리 상태 변경 + 이력 추가 + 알림) 부분 커밋을 방지하기 위함.
- 예외: `delete_plant` 처럼 단일 작업은 service에서도 직접 처리.

## 3. 계층 (프론트엔드)

| 계층 | 역할 |
|------|------|
| **app/ (페이지)** | 라우팅, 데이터 페치(useQuery), UI 조립 |
| **components/** | 재사용 컴포넌트 (Sidebar, ChatPanel, NotificationsPopover) |
| **lib/api/** | fetch 래퍼 + 도메인별 API 함수 |
| **lib/store/** | Zustand 전역 상태 (auth, chat 열림/스코프, theme) |
| **lib/status.ts** | 봉우리 상태 표시용 단일 소스 (label/color/pill) |

## 4. 요청 흐름 — 일반 페이지 로드

```
1.  사용자가 /plants 로 진입
2.  AppLayout이 마운트
    └─► useEffect: configureClient(getToken, refresh) 등록
        └─► refreshToken() 호출 → 쿠키 기반 refresh로 access 발급
        └─► apiGet("/me")로 사용자 로드 후 authStore.setSession
3.  PlantsPage 마운트
    └─► useQuery(["plants",...]) → apiGet("/plants?sort=activity")
    └─► useQuery(["buds",{}])    → apiGet("/buds")
4.  데이터 도착 시 PlantCard 그리드 렌더
5.  카드 클릭 → router.push(`/plants/${id}`)
```

## 5. 요청 흐름 — AI 채팅 (SSE)

```
1.  사용자가 ChatPanel에서 "취업·건강 식물 만들고 봉우리 추가" 입력
2.  streamChat() 호출 → POST /api/v1/chat/message (Bearer 토큰)
3.  FastAPI:
    a. require_user → User 객체
    b. _resolve_api_key → DB의 암호화된 키 복호화 (없으면 .env 키)
    c. LLMClient 인스턴스화 + 서비스 묶음 + ChatOrchestrator
    d. StreamingResponse(generate(), media_type="text/event-stream")
4.  ChatOrchestrator.run() (제너레이터):
    Step 1:
      ┌─ event: start
      └─ LLM.chat(history, tools, system_prompt)
         ↓ Gemini가 think 스킬 호출 결정
      ┌─ event: tool_call  {name: "think", ...}
      └─ registry.dispatch("think", ...) → SkillResult
      ┌─ event: tool_result
      └─ working_history 에 tool_use + tool_result 추가
    Step 2~N: 같은 방식으로 match_plant → create_plant → ...
    최종:
      └─ event: token (단어 단위)
      └─ event: done
5.  브라우저는 reader.read() 루프로 청크를 받아 onToken/onToolResult 콜백 호출
6.  스킬 결과에 따라 invalidateQueries로 영향받는 화면을 자동 재페치
```

이 멀티스킬 체인이 단일 사용자 발화에 대해 자동으로 작동하는 것이 본 MVP의 핵심 가치입니다.
자세한 내용은 `04_AI_Chat_And_Skills.md` 참고.

## 6. 외부 통합

| 외부 서비스 | 무엇으로 통신 | 누가 호출 | 키 보관 |
|-------------|--------------|-----------|---------|
| Google Gemini API | `google-genai` SDK (REST) | `LLMClient` | 사용자별 암호화 (Fernet, key = `KEY_ENCRYPTION_SECRET` SHA-256) |

LLM 키는 두 경로에서 들어옵니다.
1. `User.encrypted_api_key` — 설정 → AI → Gemini API 키 입력 시 저장.
2. `settings.llm_api_key` — `.env` 의 `LLM_API_KEY` (개발자/관리자 fallback).

`_resolve_api_key()` 가 1번 → 2번 순서로 시도.

## 7. 인증 모델

| 토큰 | 저장 위치 | 만료 | 갱신 방법 |
|------|-----------|------|-----------|
| Access | 메모리(Zustand) | 15분 | 401 시 refresh 자동 호출 |
| Refresh | HTTP-only 쿠키 (`samesite=lax`) | 14일 | 사용자 명시적 로그아웃 시 삭제 |

`apiFetch()` 가 401을 만나면 `_refresh()` 클로저를 호출해 access를 재발급한 뒤
같은 요청을 한 번 재시도합니다 — 사용자에게는 끊김 없이 보입니다.

## 8. 스케줄러

`scheduler/jobs.py` — APScheduler `BackgroundScheduler` 가 10분마다
`TransitionService.scan_all(db)` 를 실행.

작업 내용:
1. 활성 봉우리(seed/bud/flower/fruit)가 `wilting_days` 동안 변화 없으면 `wilting` 으로 전이 + 알림.
2. `wilting` 상태로 `rot_disappear_days` 경과 시 `rot` + `disappeared_at` 설정 + 알림.
3. 마감일이 `deadline_warn_days` 이내인 활성 봉우리에 `deadline_warning` 알림.

스케줄러는 `lifespan` 컨텍스트에서 앱 시작 시 켜고, 종료 시 `shutdown()` 호출.

## 9. 로그

`backend/logs/chat/` 에 채팅 한 턴마다 JSON 파일 1개가 생성됩니다.
파일 이름: `YYYYMMDD_HHMMSS_<user_id 앞 8자>.json`

내용:
- 사용자 입력
- 시스템 프롬프트 전체
- 매 LLM 호출의 messages·tools 카운트·result_text·result_tool_use
- 매 스킬 호출의 args·data·ok 결과
- 이벤트 타임라인

디버깅과 프롬프트 튜닝의 핵심 자료. 디스크 사용 주의 (현재 보존 정책 없음 — 향후 작업).
