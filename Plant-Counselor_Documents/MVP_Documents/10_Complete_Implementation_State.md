# 10. 완성본 구현 상태 (최종 기준 문서)

> **최종 업데이트**: 2026-05-27  
> 이 문서는 MVP 개발 완료 시점의 전체 구현 상태를 기록합니다.  
> 이전 세션들에서 누적된 변경사항을 모두 포함한 단일 기준 문서입니다.

---

## 1. 프로젝트 한 줄 요약

**"고민과 일정을 식물 생애주기에 비유해 AI 정원사와 함께 가꾸는 웹 서비스."**

자연어 입력 → AI가 식물(분야)·봉우리(고민/일정) 자동 생성 → 진행 상황 추적 → 픽셀아트 정원 시각화

---

## 2. 구현 완료 기능 체크리스트

### ✅ 인증
- [x] 닉네임 + 비밀번호 가입 / 로그인
- [x] JWT 액세스(15분) + HTTP-only 리프레시(14일)
- [x] 401 자동 갱신 + 요청 재시도
- [x] 비밀번호 변경, 계정 삭제(닉네임 확인)
- [x] Argon2 비밀번호 해싱

### ✅ 식물(Plant)
- [x] AI 자연어로 생성 (match_plant → create_plant 자동 체인)
- [x] 목록: 정렬(최근활동/활성/생성순) + 검색
- [x] 상세: 통계 + 봉우리 목록 + 필터
- [x] 삭제: 보관(soft) / 완전삭제(hard), 2단계 확인

### ✅ 봉우리(Bud)
- [x] 7가지 상태: seed → bud → flower → fruit → wilting → rot / harvested
- [x] 2가지 타입: concern(고민), schedule(일정)
- [x] 진행률(0~100%) → 자동 상태 전이 (30%/60%/85% 임계)
- [x] 마감일(deadline) YYYY-MM-DD 저장 + 캘린더 연동
- [x] detail 필드: 시간·장소 등 구체 정보 (캘린더 이벤트 카드에 표시)
- [x] 상세 드로어: 메타 + 이력 타임라인 + 빠른 액션 (+20%/수확/포기)
- [x] 수확(harvested) / 포기(rot) 처리

### ✅ AI 채팅 시스템
- [x] 자연어 → ReAct 루프(MAX_STEPS=10) → 스킬 자동 호출
- [x] 질문 금지 원칙: AI가 확인 없이 의도 추론·즉시 실행
- [x] 4가지 대화 스코프: global / plant / bud / calendar
- [x] 15개 스킬 전체 구현
- [x] SSE 스트리밍 (token 이벤트, 단어 단위)
- [x] 스킬 실행 후 TanStack Query 자동 캐시 무효화
- [x] 7가지 채팅 명령어 (/clear, /compact, /plants, /new, /settings, /skills, /use)
- [x] 대화 이력 DB 저장 + 스코프별 격리

### ✅ 캘린더 & 일정
- [x] 월별 그리드 + 이벤트 도트(최대 3개) + 클릭 시 목록 펼침
- [x] 이벤트 카드: 제목 + 식물명 badge + detail(시간) + 타입(일정/고민)
- [x] "일정 AI와 대화" → calendar 스코프 채팅 (일정 조회·생성·수정 전용)
- [x] "+ 일정 추가" → global 채팅 열기
- [x] AI가 일정 자동 분류: "밥먹기" → 일상, "면접" → 취업 (질문 없이)
- [x] "오늘", "내일" → 자동 날짜 변환
- [x] 오늘 일정 패널 (우측)
- [x] AI 일정 제안 (daily briefing 기반)

### ✅ 픽셀아트 정원
- [x] 식물 스프라이트: 140×240px (곡선 줄기 + 둥근 잎 + 화분)
- [x] 봉우리 스프라이트 6종: seed / sprout / flower / fruit / wilted / harvested
- [x] 봉우리 슬롯 6개: 가지 끝 좌표에 봉우리 자동 배치 (center anchor)
- [x] 하늘 배경 (구름 포함) + 잔디 타일 + 흙 레이어
- [x] 가로 스크롤 캐러셀 + CSS scroll-snap
- [x] 화살표 키(←→) 네비게이션 (딜레이 없음, setTimeout 제거)
- [x] 선택된 식물 강조 (scale 1.08, opacity 1.0)
- [x] 봉우리 hover tooltip (봉우리 이름)
- [x] 정원뷰 ↔ 리스트뷰 토글
- [x] 정원뷰: 카드 내부 sky 배경, 하단 잔디/흙 absolute 배치

### ✅ 알림
- [x] 시들 알림: wilting_days(기본 7일) 이상 활동 없을 때
- [x] 썩음 알림: 시든 후 rot_disappear_days(기본 14일) 경과
- [x] 마감 임박: deadline_warn_days(기본 3일) 이내 마감
- [x] 사이드바 배지: 30초 폴링으로 안 읽은 수 표시
- [x] 팝오버: 읽음 / 모두읽음 처리
- [x] 10분 APScheduler 자동 전이 + 알림 생성

### ✅ 테마
- [x] 모드: light / dark / system
- [x] 강조색 4종: emerald / sapphire / violet / sunset
- [x] Pre-hydration (theme-init.js): 첫 페인트 깜빡임 없음
- [x] localStorage persist

### ✅ 설정
- [x] 5탭: 계정 / AI / 정원 규칙 / 테마 / 정보
- [x] Gemini API 키: Fernet 암호화 저장 + 마스킹 표시
- [x] 응답 톤: 상담사 / 비서 / 친구
- [x] 정원 규칙: wilting_days / rot_disappear_days / deadline_warn_days (NumberStepper)
- [x] 테마 시각적 카드 프리뷰

### ✅ 개발 환경
- [x] pyproject.toml + requirements.txt (google-genai SDK 의존성 올바르게 수정)
- [x] .env.example + 상세 README.md (venv 설정 설명 포함)
- [x] .gitignore (secrets/venv/node_modules 제외)
- [x] 스프라이트 생성기: `scripts/generate_pixel_sprites.py`

---

## 3. 파일 구조 (완전판)

```
plant-counselor/
│
├── backend/
│   ├── app/
│   │   ├── ai/
│   │   │   ├── chat_orchestrator.py  # ReAct 루프 (MAX_STEPS=10)
│   │   │   ├── llm_client.py         # Gemini 2.5 Flash API 래퍼
│   │   │   ├── log_recorder.py       # 채팅 로그 JSON 저장
│   │   │   ├── prompt_builder.py     # 시스템 프롬프트 7섹션 조립
│   │   │   ├── skill_base.py         # SkillBase + SkillContext + SkillResult
│   │   │   ├── skill_registry.py     # 스킬 등록 + build_catalog()
│   │   │   └── skills/               # 15개 스킬 (각 파일)
│   │   │       ├── think.py
│   │   │       ├── match_plant.py
│   │   │       ├── create_plant.py
│   │   │       ├── delete_plant.py
│   │   │       ├── create_bud.py
│   │   │       ├── update_bud_status.py
│   │   │       ├── update_bud_progress.py
│   │   │       ├── set_deadline.py
│   │   │       ├── harvest_bud.py
│   │   │       ├── abandon_bud.py
│   │   │       ├── list_plants.py
│   │   │       ├── list_buds.py
│   │   │       ├── get_statistics.py
│   │   │       ├── get_garden_briefing.py
│   │   │       └── search_conversation.py
│   │   │
│   │   ├── auth/
│   │   │   └── jwt.py                # create_access_token, verify_token
│   │   │
│   │   ├── db/
│   │   │   ├── base.py               # DeclarativeBase
│   │   │   ├── session.py            # engine + SessionLocal
│   │   │   └── models/
│   │   │       ├── user.py           # User (ULID PK, Argon2, JSON garden_rules)
│   │   │       ├── plant.py          # Plant (status, stats JSON)
│   │   │       ├── bud.py            # Bud + BudHistory (7 상태, progress, detail)
│   │   │       ├── conversation.py   # Conversation + ConversationMessage
│   │   │       ├── notification.py   # Notification (kind, payload, acked_at)
│   │   │       └── garden_state.py   # GardenState (summary_cache, briefing)
│   │   │
│   │   ├── repositories/             # DB CRUD 레이어 (6개)
│   │   ├── services/                 # 비즈니스 로직 (6개)
│   │   │   ├── plant_service.py      # find_matches(), create(), list()
│   │   │   ├── bud_service.py        # create(), update_progress (자동 전이)
│   │   │   ├── conversation_service.py  # get_history(), append()
│   │   │   ├── garden_state_service.py  # refresh_summary(), get_daily_briefing()
│   │   │   ├── transition_service.py    # scan_all() → 시들/썩음 자동 전이
│   │   │   └── user_service.py       # get_api_key(), set_api_key (Fernet)
│   │   │
│   │   ├── schemas/                  # Pydantic v2 스키마 (4개)
│   │   ├── routers/                  # FastAPI 라우터 (8개)
│   │   │   ├── auth.py               # /auth/signup, /login, /refresh, /logout
│   │   │   ├── me.py                 # /me (GET/PATCH/DELETE), /me/password, /me/api-key
│   │   │   ├── plants.py             # CRUD /plants, /plants/{id}
│   │   │   ├── buds.py               # /buds, /buds/{id}
│   │   │   ├── stats.py              # /stats/summary, /briefing/today, /calendar
│   │   │   ├── chat.py               # POST /chat/message → SSE
│   │   │   ├── conversations.py      # /conversations (이력 조회)
│   │   │   └── notifications.py      # /notifications, /ack
│   │   │
│   │   ├── scheduler/
│   │   │   └── jobs.py               # APScheduler 10분 interval
│   │   │
│   │   ├── config.py                 # pydantic-settings → .env 바인딩
│   │   ├── deps.py                   # get_db, require_user (FastAPI 의존성)
│   │   └── main.py                   # FastAPI app, CORS, 라우터 등록
│   │
│   ├── pyproject.toml                # 의존성 선언 (google-genai, fastapi 등)
│   ├── requirements.txt              # pyproject.toml 미러 (pip 직접 설치용)
│   ├── .env.example                  # 환경변수 템플릿
│   └── run.py                        # uvicorn 진입점
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx                # root: html, body, theme-init Script
│   │   ├── providers.tsx             # QueryClientProvider, AuthGate
│   │   ├── globals.css               # 디자인 토큰 (cream/olive 팔레트)
│   │   ├── (auth)/login/page.tsx     # 가입/로그인
│   │   └── (app)/
│   │       ├── layout.tsx            # Sidebar + ChatPanel overlay
│   │       ├── page.tsx              # 홈 (브리핑, 통계, 식물 보드, 시들 봉우리)
│   │       ├── plants/
│   │       │   ├── page.tsx          # 정원(캐러셀+스프라이트) / 리스트 뷰
│   │       │   └── [id]/page.tsx     # 식물 상세 + BudDetailDrawer
│   │       ├── calendar/page.tsx     # 캘린더 + 일정 AI 채팅
│   │       └── settings/page.tsx     # 5탭 설정
│   │
│   ├── components/
│   │   ├── chat/ChatPanel.tsx        # SSE 스트리밍, 명령어, 스코프 breadcrumb
│   │   └── layout/
│   │       ├── Sidebar.tsx           # 다크 올리브 사이드바 + 알림 배지
│   │       └── NotificationsPopover.tsx
│   │
│   ├── lib/
│   │   ├── api/                      # fetch 래퍼 (8개)
│   │   │   ├── client.ts             # configureClient, apiFetch (401 자동 갱신)
│   │   │   ├── auth.ts, me.ts        # 인증 API
│   │   │   ├── plants.ts, buds.ts    # 식물/봉우리 API
│   │   │   ├── stats.ts              # CalEvent 인터페이스 (id,title,status,type,detail,plant_name,plant_id)
│   │   │   ├── conversations.ts      # 대화 이력
│   │   │   └── notifications.ts      # 알림
│   │   │
│   │   ├── store/
│   │   │   ├── authStore.ts          # user, token, setSession, logout
│   │   │   ├── chatStore.ts          # open, scope{kind,id}, openWith(), close()
│   │   │   └── themeStore.ts         # mode, accent, setMode(), setAccent()
│   │   │
│   │   └── status.ts                 # STATUS_LABEL, STATUS_PILL, STATUS_COLOR_VAR, dominantStatus()
│   │
│   ├── public/sprites/               # 픽셀아트 스프라이트 (PNG)
│   │   ├── plant.png                 # 140×240px (줄기+잎+화분 합성)
│   │   ├── sky.png, grass.png        # 배경
│   │   ├── bud_seed.png              # 20×28
│   │   ├── bud_sprout.png            # 36×28
│   │   ├── bud_flower.png            # 36×32
│   │   ├── bud_fruit.png             # 28×32
│   │   ├── bud_wilted.png            # 28×24
│   │   └── bud_harvested.png         # 28×20
│   │
│   └── package.json                  # next16, react19, zustand, tanstack-query
│
├── assets/sprites/                   # 스프라이트 원본 (생성기 출력)
├── scripts/
│   └── generate_pixel_sprites.py     # Pillow 기반 스프라이트 생성기 (v5)
├── ref_images/                       # 디자인 레퍼런스 이미지 (홈/정원/캘린더 UI 컨셉)
├── Plant-Counselor_Documents/
│   └── MVP_Documents/                # 이 문서 포함 10편
├── README.md                         # 빠른 시작 + venv 설명 + requirements.txt 설명
├── .gitignore                        # secrets, venv, node_modules, .claude 제외
└── backend/requirements.txt
```

---

## 4. AI 시스템 설계 (최신 기준)

### 4.1 ReAct 루프

```python
MAX_STEPS = 10

for step in range(MAX_STEPS):
    result = llm.chat(working_history, catalog, system_prompt)
    text, tool_use = result["text"], result["tool_use"]

    if not text and not tool_use:  # 빈 응답 1회 재시도
        result = llm.chat(...)

    if tool_use:
        yield "event: tool_call"
        skill_result = registry.dispatch(name, input, ctx)
        yield "event: tool_result"
        working_history += [assistant(tool_use), user(tool_result)]  # 다음 스텝에서 LLM이 결과를 봄
        continue

    break  # 텍스트 응답 → 종료

if not response_text:  # MAX_STEPS 소진
    response_text = llm.chat(working_history, [], system)["text"] or "작업을 완료했습니다."
```

### 4.2 15개 스킬

| # | 이름 | 타입 | 주요 파라미터 |
|---|------|------|--------------|
| 1 | think | 메타 | reasoning |
| 2 | match_plant | 조회 | query |
| 3 | create_plant | 변경 | name, description |
| 4 | delete_plant | 변경 | plant_id, archive? |
| 5 | create_bud | 변경 | plant_id, title, type, detail?, deadline? |
| 6 | update_bud_status | 변경 | bud_id, to_status |
| 7 | update_bud_progress | 변경 | bud_id, progress(0~100) |
| 8 | set_deadline | 변경 | bud_id, deadline(YYYY-MM-DD) |
| 9 | harvest_bud | 변경 | bud_id |
| 10 | abandon_bud | 변경 | bud_id |
| 11 | list_plants | 조회 | include_dormant?, sort? |
| 12 | list_buds | 조회 | plant_id?, status?, type? |
| 13 | get_statistics | 조회 | scope?, period? |
| 14 | get_garden_briefing | 조회 | (없음) |
| 15 | search_conversation | 조회 | query, scope? |

### 4.3 프롬프트 핵심 규칙 (prompt_builder.py)

1. **즉시 실행** — 의도 파악 시 확인 없이 스킬 호출
2. **질문 금지** — "~할까요?" 절대 금지, 문맥에서 추론
3. **일정 자동 분류** — "밥먹기"→일상, "면접"→취업, "오늘"→ISO 날짜
4. **캘린더 스코프** — list_buds(type=schedule) 로 일정 조회
5. **빈 응답 금지** — 스킬 or 텍스트 중 하나는 반드시

### 4.4 대화 스코프

| 스코프 | kind 값 | current_screen | 격리 단위 |
|--------|---------|----------------|----------|
| 전체 정원 | "global" | "웹" | user_id |
| 식물별 | "plant" | "웹" | (user_id, plant_id) |
| 봉우리별 | "bud" | "웹" | (user_id, bud_id) |
| 캘린더 | "calendar" | "캘린더" | user_id |

DB unique 제약: `(user_id, scope, scope_id)` → 같은 식물에서 여러 번 대화해도 같은 conversation_id 공유.

### 4.5 스킬 → 쿼리 무효화 매핑 (ChatPanel.tsx)

```typescript
const SKILL_INVALIDATIONS = {
  create_plant:        ["plants", "stats"],
  delete_plant:        ["plants", "buds", "stats"],
  create_bud:          ["buds", "plants", "stats", "calendar"],
  update_bud_status:   ["buds", "plants", "stats", "bud"],
  update_bud_progress: ["buds", "bud"],
  harvest_bud:         ["buds", "plants", "stats", "bud"],
  abandon_bud:         ["buds", "plants", "stats", "bud"],
  set_deadline:        ["buds", "bud", "calendar", "stats"],
};
```

---

## 5. 픽셀아트 스프라이트 시스템

### 5.1 생성기 (`scripts/generate_pixel_sprites.py`)

- Python Pillow 기반, 프로그래매틱 드로잉
- `auto_crop(img)` → `img.getbbox()`로 투명 여백 제거
- `make_plant()` → 줄기 곡선(curve_points) + 둥근 잎(filled_ellipse) + 화분
- 슬롯 좌표 6개: 가지 끝 → crop offset 보정 → `manifest.json` 저장
- 봉우리 스프라이트: 줄기 없이 각 요소만 (seed/sprout/flower/fruit/wilted/harvested)
- 재생성: `python scripts/generate_pixel_sprites.py && cp assets/sprites/* frontend/public/sprites/`

### 5.2 정원 뷰 레이아웃 (plants/page.tsx)

```
┌─────────────────────────────────────────────┐
│  [하늘 배경: position:absolute, zIndex:0]    │
│  ┌─ ‹ 2/4 › ─────────────────────── ┐       │
│  │  스크롤 row (zIndex:2, padding:   │       │
│  │  48px 80px 100px)                 │       │
│  │  [식물 A]  [식물 B]  [식물 C]    │       │
│  │    이름      이름      이름       │       │
│  │  [상세][상담]                     │       │
│  └───────────────────────────────── ┘       │
│  [잔디+흙: position:absolute, bottom:0,      │
│   zIndex:1, pointerEvents:none, height:52px] │
└─────────────────────────────────────────────┘
```

**핵심**: 잔디/흙이 `zIndex:1`, 식물 레이블/버튼이 `zIndex:10` → 버튼이 잔디 위에 표시됨

### 5.3 봉우리 슬롯 좌표

```typescript
const SLOTS = [
  { x: 28, y: 12 }, { x: 108, y: 12 },  // 상단 가지 끝
  { x: 20, y: 56 }, { x: 116, y: 56 },  // 중단 가지 끝
  { x: 32, y: 108 }, { x: 104, y: 108 } // 하단 가지 끝
];
// 배치: left = slot.x * scale - meta.ax * scale (center anchor)
//       top  = slot.y * scale - meta.ay * scale
```

---

## 6. 디자인 시스템 (globals.css)

### 6.1 팔레트

| 토큰 | Light | Dark | 용도 |
|------|-------|------|------|
| `--bg` | #F5F2EB (크림) | #1A1D16 | 기본 배경 |
| `--bg-sidebar` | #3D4A30 (다크 올리브) | #2A3520 | 사이드바 |
| `--fg` | #2A2A2A | #E8E4DB | 기본 텍스트 |
| `--accent` | #5C6B3F (올리브) | #8BA05A | 강조 |
| `--bg-elevated` | #FFFFFF | #252820 | 카드 배경 |
| `--border` | rgba(0,0,0,0.08) | rgba(255,255,255,0.08) | 테두리 |

### 6.2 주요 CSS 클래스

| 클래스 | 용도 |
|--------|------|
| `.card` | 카드 컨테이너 (배경, 테두리, 그림자) |
| `.card-hover` | hover 시 약한 lift 효과 |
| `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost` | 버튼 변형 |
| `.btn-sm`, `.btn-lg` | 버튼 크기 |
| `.input` | 인풋 스타일 |
| `.t-display`, `.t-h1`~`.t-h3`, `.t-body`, `.t-caption` | 타이포그래피 |
| `.animate-in`, `.stagger` | 등장 애니메이션 |
| `.pill-*` | 상태 pill 배지 |
| `.bud-tooltip` | 봉우리 hover 툴팁 (opacity 0→1) |

---

## 7. 최근 세션에서 수정된 사항 (2026-05-27)

### 7.1 방향키 네비게이션 버그 수정 (plants/page.tsx)

**문제**: `setTimeout(50)` 딜레이 + stale closure로 인한 스크롤 에러

**수정 전**:
```typescript
const navigate = useCallback((dir) => {
  setSelectedIdx(prev => {
    const next = Math.max(0, Math.min(filtered.length - 1, prev + dir));
    setTimeout(() => {
      children[next].scrollIntoView(...)  // stale 클로저 + 50ms 딜레이
    }, 50);
    return next;
  });
}, [filtered.length]);
```

**수정 후**:
```typescript
// navigate: 상태만 업데이트
const navigate = useCallback((dir) => {
  setSelectedIdx(prev => Math.max(0, Math.min(filtered.length - 1, prev + dir)));
}, [filtered.length]);

// 별도 effect: React 재렌더 완료 후 스크롤 (DOM 준비 보장, setTimeout 불필요)
useEffect(() => {
  if (view !== "garden") return;
  const el = scrollRef.current?.children[selectedIdx] as HTMLElement;
  el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
}, [selectedIdx, view]);

// selectedIdxRef: 키보드 핸들러의 Enter 스코프에서 stale closure 방지
const selectedIdxRef = useRef(selectedIdx);
useEffect(() => { selectedIdxRef.current = selectedIdx; }, [selectedIdx]);
```

### 7.2 pyproject.toml 의존성 수정

- `anthropic` 제거 (코드에서 미사용)
- `google-genai>=1.0.0` 추가 (실제 사용 중인 Gemini SDK)

### 7.3 requirements.txt 추가

- `pip install -r requirements.txt` 방식 지원
- 각 패키지 한국어 주석 포함

### 7.4 README.md 대폭 확장

- `.venv` 생성/활성화 상세 설명 (Windows/Mac/Linux)
- `pip install -e .` vs `pip install -r requirements.txt` 차이 설명
- 의존성 구조 테이블 추가

---

## 8. 환경 구성

### 8.1 백엔드 (backend/.env)

```dotenv
DATABASE_URL=sqlite:///./plant_counselor.db
JWT_SECRET=<32자 이상 랜덤 문자열>
JWT_ACCESS_TTL=15
JWT_REFRESH_TTL=14
LLM_API_KEY=<Gemini API Key from AI Studio>
KEY_ENCRYPTION_SECRET=<32자 이상 랜덤 문자열>
CORS_ALLOW_ORIGIN=http://localhost:3000
```

### 8.2 실행 순서

```bash
# 1. 백엔드
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1   # Windows PowerShell
pip install -e .
cp .env.example .env          # 편집 후
python run.py                 # → http://localhost:8000

# 2. 프론트엔드 (새 터미널)
cd frontend
pnpm install
pnpm dev                      # → http://localhost:3000

# 3. 스프라이트 재생성 (선택)
cd ..
pip install Pillow
python scripts/generate_pixel_sprites.py
cp assets/sprites/* frontend/public/sprites/
```

---

## 9. 미완성 / 향후 개선 사항

### 즉시 가능한 개선

| 항목 | 현재 상태 | 개선 방향 |
|------|-----------|-----------|
| detail 시간 파싱 | 문자열 그대로 저장 | "오후 1시" → HH:MM 정규화 |
| 봉우리 직접 수정 | 드로어에서 제목/메모 편집 없음 | PATCH /buds/{id} 폼 추가 |
| 식물 편집 | 이름/설명 편집 UI 없음 | 상세 페이지 inline 편집 |
| 검색 범위 | 리스트뷰만 검색 | 정원뷰에도 필터 연동 |
| 봉우리 정렬 | 생성순 고정 | 마감순 / 진행률순 토글 |

### 중기 개선

| 항목 | 설명 |
|------|------|
| 봉우리 이동 | 다른 식물로 봉우리 옮기기 |
| 통계 차트 | 주간/월간 진행률 그래프 |
| 반복 일정 | 매주 월요일 등 recurrence |
| 모바일 반응형 | 현재 desktop 최적화 |
| PostgreSQL 연동 | prod 환경 DB 교체 |

---

## 10. 기술 결정 요약

| 결정 | 이유 |
|------|------|
| ULID (정렬 가능 ID) | 시간 순서 보장 + URL-safe + 디버깅 용이 |
| Argon2 해시 | GPU 공격에 bcrypt보다 안전 |
| Fernet 암호화 | 단일 배포 환경에서 충분, 키 회전 가능 |
| HTTP-only 리프레시 쿠키 | XSS로 토큰 탈취 방지 |
| 동기 SSE 제너레이터 | 동기 SQLAlchemy 세션과 자연스럽게 결합 |
| Anthropic IR → Gemini 변환 | 향후 Claude/OpenAI 전환 시 어댑터만 교체 |
| ReAct 자체 구현 | LangChain 등 외부 의존 최소화 |
| TanStack Query invalidation | 스킬 실행 후 자동 UI 갱신 |
| detail 필드에 시간 저장 | DB 마이그레이션 없이 시간 정보 표현 (MVP 타협) |
| 크림/올리브 팔레트 | ref_images 기반 — 따뜻한 정원 분위기 |
| setTimeout 제거 | state update + DOM effect 분리 → useEffect 사용 |
