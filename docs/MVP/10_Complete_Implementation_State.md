# 10. 완성본 구현 상태 (최종 기준 문서)

> **최종 업데이트**: 2026-05-28  
> 이 문서는 가장 최근 구현 상태를 기록하는 단일 기준 문서입니다.  
> 이전 세션에서 누적된 변경사항을 모두 포함합니다.

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
- [x] 상태: bud → flower → fruit → harvested / wilting → rot (씨앗 seed는 migration 004로 제거, `normalizeBudStatus` 읽기 호환)
- [x] 2가지 타입: concern(고민), schedule(일정)
- [x] 진행률(0~100%) → 자동 상태 전이 (60%/85% 임계), 수확은 100%에서만
- [x] 마감일(deadline) YYYY-MM-DD 저장 + 캘린더 연동
- [x] detail 필드: 시간·장소 등 구체 정보 (캘린더 이벤트 카드에 표시)
- [x] 상세 드로어: 메타 + 이력 타임라인 + 빠른 액션 (+20%/수확/포기)
- [x] 드로어가 채팅 패널 옆으로 이동 (z:45, right: chatWidth 동기화)
- [x] 수확(harvested) / 포기(rot) 처리
- [x] **시듦은 성장의 종착점(소생 불가)**: 봉우리/식물이 시들면 성장(진행도 상승·전진 상태전이·수확) 차단, 대화는 계속 가능 (`bud_service` 가드). 시듦→썩음·포기는 허용.

### ✅ AI 채팅 시스템
- [x] 자연어 → ReAct 루프(MAX_STEPS=10) → 스킬 자동 호출
- [x] 질문 금지 원칙: AI가 확인 없이 의도 추론·즉시 실행
- [x] 4가지 대화 스코프: global / plant / bud / calendar
- [x] 15개 스킬 전체 구현
- [x] SSE 스트리밍 (token 이벤트, 단어 단위)
- [x] 스킬 실행 후 TanStack Query 자동 캐시 무효화
- [x] "briefing" 캐시 무효화 포함 (plant/bud 생성·상태변경·수확·포기 시)
- [x] 7가지 채팅 명령어 (/clear, /compact, /plants, /new, /settings, /skills, /use)
- [x] 대화 이력 DB 저장 + 스코프별 격리
- [x] **봉우리 탐색 강제 규칙**: bud_id 필요 스킬 호출 전 반드시 list_buds 먼저
- [x] 드래그 리사이즈 핸들 (min 280px ~ max 700px, 폭 persist)
- [x] 브레드크럼 라벨 캐시 기반 즉시 표시 (useQuery로 교체)

### ✅ 대화 기록 브라우저 (`/history`)
- [x] 2-패널 레이아웃: 좌측 트리 + 우측 스레드 뷰
- [x] 트리: global → calendar → 식물 → 봉우리 계층 구조
- [x] 식물/봉우리 이름 해석 (scope_id → 실명 매핑)
- [x] 사라진 봉우리 dimmed 표시
- [x] 트리 내 키워드 검색 (필터)
- [x] 스레드 내 메시지 검색
- [x] "이 대화 이어가기" → 채팅 패널 + 해당 페이지로 이동
- [x] hover 프리페치 (마우스 오버 시 스레드 데이터 미리 로드)
- [x] 고정 높이 레이아웃 (overflow scroll, 박스 팽창 없음)
- [x] 사이드바 "대화 기록" 링크 + hover 프리페치

### ✅ 캘린더 & 일정
- [x] 월별 그리드 + 이벤트 도트(최대 3개) + 클릭 시 목록 펼침
- [x] 이벤트 카드: 제목 + 식물명 badge + detail(시간) + 타입(일정/고민)
- [x] "일정 AI와 대화" → calendar 스코프 채팅 (일정 조회·생성·수정 전용)
- [x] "+ 일정 추가" → global 채팅 열기
- [x] AI가 일정 자동 분류: "밥먹기" → 일상, "면접" → 취업 (질문 없이)
- [x] "오늘", "내일" → 자동 날짜 변환
- [x] 오늘 일정 패널 (우측)
- [x] AI 일정 제안 (daily briefing 기반)
- [x] 인접 월 프리페치 (‹/› 클릭 시 즉시 응답)

### ✅ 벡터 픽셀아트 정원 (`components/plants/GardenPlantVisual.tsx`)
- [x] 식물을 `Pixel` 사각형으로 그리는 벡터 그래픽 (줄기/잎/봉우리/꽃/열매/시듦/화분)
- [x] 줌(0.5~2x, Ctrl+휠)·양방향 스크롤 보드, 화살표 키(←→) 네비게이션
- [x] 봉우리 hover tooltip, 정원뷰 ↔ 리스트뷰 토글
- [x] 우측 상단 **AI 대화 버튼** (다른 페이지처럼 전역 채팅 열기)
- [x] **수확 바구니** (`GardenHarvestBasket`): 화분 리스트 가장 왼쪽 슬롯의 줄무늬 짜임 바구니(벡터). 모든 식물의 수확 열매를 화분에서 빼서 바구니에 실제로 쌓아 표시(식물 이름 라벨)
  - 클릭 → 우측 사이드바(검색 + 식물 라벨 다중선택 필터, 비선택 식물 열매 불투명)
  - 열매 클릭 → 과거 대화 기록 팝업(`getHistory("bud")`, 추가 대화 없음)
- [x] **시듦 = 갈색**: `--st-wilting`/픽셀 시듦 색 갈색, 식물 전체 시듦 시 화분째 갈색 필터

### ✅ 알림
- [x] 시들 알림: wilting_days(기본 7일) 이상 활동 없을 때
- [x] 썩음 알림: 시든 후 rot_disappear_days(기본 14일) 경과
- [x] **식물 전체 시듦**: 봉우리 N개(기본 2) 이상 시들고 M일(기본 3) 경과 시 식물 `status="wilting"` + `plant_wilting` 알림 (`plant_wilt_bud_threshold`/`plant_wilt_days`, 사용자 garden_rules로 조절 가능)
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
- [x] 응답 톤: 상담사 / 비서 / 친구 — **프롬프트에 실제 반영** (prompt_builder `_TONE_GUIDE` → chat.py → orchestrator)
- [x] 정원 규칙: wilting_days / rot_disappear_days / deadline_warn_days (NumberStepper) + 식물 시듦 임계(plant_wilt_bud_threshold / plant_wilt_days, garden_rules)
- [x] 테마 시각적 카드 프리뷰

### ✅ 성능 최적화
- [x] 레이아웃 레벨 프리페치: 토큰 확보 즉시 plants/buds/summary/briefing 캐시 워밍
- [x] `enabled: !!accessToken` 가드: 모든 페이지 쿼리에 적용 (콜드 스타트 401 제거)
- [x] QK 팩토리 정규화: 모든 페이지에서 동일 캐시 키 사용
- [x] Sidebar hover 프리페치: 링크 위에 마우스 올리면 해당 페이지 데이터 미리 로드
- [x] initialData 패턴: 식물 상세 페이지가 list 캐시에서 즉시 헤더 렌더
- [x] 캘린더 인접 월 프리페치

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
│   │   │   ├── prompt_builder.py     # 시스템 프롬프트 (봉우리 탐색 규칙 포함)
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
│   │   │       ├── list_buds.py      # description에 "bud_id 필요 시 먼저 호출" 명시
│   │   │       ├── get_statistics.py
│   │   │       ├── get_garden_briefing.py
│   │   │       └── search_conversation.py
│   │   │
│   │   ├── auth/
│   │   │   └── jwt.py
│   │   │
│   │   ├── db/
│   │   │   ├── base.py
│   │   │   ├── session.py
│   │   │   └── models/
│   │   │       ├── user.py
│   │   │       ├── plant.py
│   │   │       ├── bud.py
│   │   │       ├── conversation.py
│   │   │       ├── notification.py
│   │   │       └── garden_state.py
│   │   │
│   │   ├── repositories/
│   │   │   └── conversation_repo.py  # list_conversations_for_user() 추가
│   │   │
│   │   ├── services/
│   │   │   ├── plant_service.py
│   │   │   ├── bud_service.py
│   │   │   ├── conversation_service.py
│   │   │   ├── garden_state_service.py
│   │   │   ├── transition_service.py
│   │   │   └── user_service.py
│   │   │
│   │   ├── schemas/
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── me.py
│   │   │   ├── plants.py
│   │   │   ├── buds.py
│   │   │   ├── stats.py
│   │   │   ├── chat.py
│   │   │   ├── conversations.py      # GET /conversations/list 추가
│   │   │   └── notifications.py
│   │   │
│   │   ├── scheduler/jobs.py
│   │   ├── config.py
│   │   ├── deps.py
│   │   └── main.py
│   │
│   ├── pyproject.toml
│   ├── requirements.txt
│   ├── .env.example
│   └── run.py
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx                # root: html, body, theme-init Script
│   │   ├── providers.tsx             # QueryClientProvider, AuthGate
│   │   ├── globals.css               # 디자인 토큰 (cream/olive 팔레트)
│   │   ├── (auth)/login/page.tsx
│   │   └── (app)/
│   │       ├── layout.tsx            # Sidebar + ChatPanel + FAB + prefetchAll()
│   │       ├── page.tsx              # 홈 (enabled guard 적용)
│   │       ├── plants/
│   │       │   ├── page.tsx          # 정원(캐러셀+스프라이트) / 리스트 뷰
│   │       │   └── [id]/page.tsx     # 식물 상세 + BudDetailDrawer (z:45)
│   │       ├── calendar/page.tsx     # 캘린더 + 인접 월 프리페치
│   │       ├── history/page.tsx      # 대화 기록 브라우저 (2-패널)
│   │       └── settings/page.tsx
│   │
│   ├── components/
│   │   ├── chat/ChatPanel.tsx        # 드래그 리사이즈, useQuery 브레드크럼, SKILL_INVALIDATIONS
│   │   └── layout/
│   │       ├── Sidebar.tsx           # 다크 올리브 + "대화 기록" 링크 + hover 프리페치
│   │       └── NotificationsPopover.tsx
│   │
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   ├── auth.ts, me.ts
│   │   │   ├── plants.ts, buds.ts
│   │   │   ├── stats.ts
│   │   │   ├── conversations.ts      # listConversations(), getHistory(), searchConversation()
│   │   │   └── notifications.ts
│   │   │
│   │   ├── queryKeys.ts              # QK 팩토리 (conversations, historyThread 추가)
│   │   ├── store/
│   │   │   ├── authStore.ts
│   │   │   ├── chatStore.ts          # chatWidth + setChatWidth persist
│   │   │   └── themeStore.ts
│   │   │
│   │   └── status.ts
│   │
│   └── public/sprites/               # 픽셀아트 스프라이트 PNG
│
├── scripts/generate_pixel_sprites.py
├── CLAUDE.md
└── README.md
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
        working_history += [assistant(tool_use), user(tool_result)]
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
4. **봉우리 탐색 필수** — bud_id 필요 스킬 호출 전 반드시 list_buds 먼저 호출
5. **캘린더 스코프** — list_buds(type=schedule)로 일정 조회
6. **빈 응답 금지** — 스킬 or 텍스트 중 하나는 반드시

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
  create_plant:        ["plants", "stats", "briefing"],
  delete_plant:        ["plants", "buds", "stats", "briefing"],
  create_bud:          ["buds", "plants", "stats", "briefing", "calendar"],
  update_bud_status:   ["buds", "plants", "stats", "briefing", "bud"],
  update_bud_progress: ["buds", "bud"],
  harvest_bud:         ["buds", "plants", "stats", "briefing", "bud"],
  abandon_bud:         ["buds", "plants", "stats", "briefing", "bud"],
  set_deadline:        ["buds", "bud", "calendar", "stats"],
};
```

`"briefing"` 키 추가: 식물/봉우리 상태가 변하면 홈 화면 AI 브리핑 자동 재로드.

---

## 5. 성능 최적화 설계

### 5.1 레이아웃 프리페치 (`app/(app)/layout.tsx`)

```typescript
function prefetchAll() {
  qc.prefetchQuery({ queryKey: QK.plants(),   queryFn: () => listPlants(), staleTime: 2 * 60_000 });
  qc.prefetchQuery({ queryKey: QK.buds(),     queryFn: () => listBuds(),   staleTime: 2 * 60_000 });
  qc.prefetchQuery({ queryKey: QK.summary(),  queryFn: getSummary,         staleTime: 2 * 60_000 });
  qc.prefetchQuery({ queryKey: QK.briefing(), queryFn: getBriefing,        staleTime: 5 * 60_000 });
}
// 토큰 확보 직후 호출 (콜드 스타트 & 이미 로그인된 상태 양쪽)
```

### 5.2 enabled 가드 패턴

```typescript
// 모든 페이지 쿼리에 적용
const { accessToken } = useAuthStore();
useQuery({ ..., enabled: !!accessToken });
// 효과: 토큰 없을 때 쿼리 실행 안 함 → 401 → 재시도 이중 요청 제거
```

### 5.3 QK 팩토리 (queryKeys.ts)

```typescript
export const QK = {
  plants:       () => ["plants", {}] as const,
  plant:        (id: string) => ["plant", id] as const,
  buds:         () => ["buds", {}] as const,
  plantBuds:    (plantId: string) => ["buds", { plant_id: plantId }] as const,
  bud:          (id: string) => ["bud", id] as const,
  summary:      () => ["stats", "summary"] as const,
  briefing:     () => ["briefing", "today"] as const,
  calendar:     (year: number, month: number) => ["calendar", year, month] as const,
  notifications:() => ["notifications"] as const,
  conversations:() => ["conversations", "list"] as const,
  historyThread:(scope: string, scopeId?: string | null) =>
    ["history", scope, scopeId ?? null] as const,
};
```

### 5.4 initialData 패턴 (캐시 워밍 후 즉시 표시)

```typescript
// plants/[id]/page.tsx — 목록 캐시에서 즉시 헤더 렌더
const { data: plantRes } = useQuery({
  queryKey: QK.plant(id),
  queryFn: () => getPlant(id),
  initialData: () => {
    const list = qc.getQueryData<ApiResult<{ items: Plant[] }>>(QK.plants());
    if (list?.ok) {
      const hit = list.data.items.find(p => p.id === id);
      if (hit) return { ok: true as const, data: hit };
    }
    return undefined;
  },
});
```

---

## 6. ChatPanel 드래그 리사이즈

```typescript
// chatStore.ts
export const DEFAULT_CHAT_W = 400;
export const MIN_CHAT_W = 280;
export const MAX_CHAT_W = 700;

// persist: chatWidth만 localStorage에 저장
{ name: "pc-chat", partialize: (state) => ({ chatWidth: state.chatWidth }) }

// ChatPanel.tsx — handleResizeStart
const startX = e.clientX; const startW = chatWidth;
document.body.style.cursor = "col-resize";
// 왼쪽으로 드래그할수록 패널 넓어짐
const delta = startX - ev.clientX;
const newW = Math.max(MIN_CHAT_W, Math.min(MAX_CHAT_W, startW + delta));
setChatWidth(newW);
```

---

## 7. BudDetailDrawer & ChatPanel 겹침 해결

```typescript
// BudDetailDrawer는 ChatPanel이 열릴 때 왼쪽으로 밀림
const drawerRight = chatOpen ? chatWidth : 0;

// aside 스타일
{
  position: "fixed",
  right: drawerRight,           // chatWidth만큼 왼쪽으로 이동
  zIndex: 45,                   // ChatPanel(40)보다 위
  transition: "right 0.22s cubic-bezier(0.32, 0.72, 0, 1)",
}

// 백드롭도 ChatPanel 가리지 않도록
{
  right: chatOpen ? chatWidth : 0,  // 백드롭 오른쪽 경계 = ChatPanel 왼쪽 경계
  zIndex: 39,
}
```

---

## 8. 대화 기록 브라우저 (`/history`)

### 8.1 데이터 흐름

```
GET /api/v1/conversations/list
  → ConversationSummary[] (scope, scope_id, message_count, last_message, updated_at)
  → buildTree(convs, plants, buds)  ← plants/buds는 캐시에서 즉시
  → TreeItem[]  (global → calendar → 식물 → 봉우리 계층)
  → 선택된 item → GET /conversations?scope=&scope_id= → 메시지 목록
```

### 8.2 백엔드 (`GET /conversations/list`)

```python
# conversation_repo.py — list_conversations_for_user()
# 3-way 조인: conversations + message count + last message
# 빈 대화(0 messages) 필터 제거
```

### 8.3 프론트 레이아웃

```
height: 100vh — 전체 뷰포트 점유
flex: 1 + minHeight: 0  — 내부 스크롤 보장 (overflow: hidden)

┌─ 좌측 트리 (280px) ─┬─ 우측 스레드 뷰 ──────────────┐
│ [검색 인풋]          │ [ScopeTag: 식물명 > 봉우리명]  │
│ ──────────────────  │ [스레드 내 검색]               │
│ 전체 대화            │ ──────────────────────────    │
│ 캘린더               │ [MessageBubble] ×N            │
│ > 식물명             │ (flex:1, overflowY:auto)       │
│   > 봉우리명 (dimmed)│ ──────────────────────────    │
│   > 봉우리명 2       │ [이 대화 이어가기 →]           │
└─────────────────────┴────────────────────────────────┘
```

---

## 9. 픽셀아트 스프라이트 시스템

### 9.1 생성기 (`scripts/generate_pixel_sprites.py`)

- Python Pillow 기반, 프로그래매틱 드로잉
- `auto_crop(img)` → 투명 여백 제거
- `make_plant()` → 줄기 곡선 + 둥근 잎 + 화분
- 슬롯 좌표 6개: 가지 끝 → crop offset 보정 → `manifest.json` 저장
- 재생성: `python scripts/generate_pixel_sprites.py && cp assets/sprites/* frontend/public/sprites/`

### 9.2 정원 뷰 레이아웃

```
┌─────────────────────────────────────────────┐
│  [하늘 배경: position:absolute, zIndex:0]    │
│  ┌─ ‹ 2/4 › ─────────────────────── ┐       │
│  │  스크롤 row (zIndex:2, padding:   │       │
│  │  48px 80px 100px)                 │       │
│  │  [식물 A]  [식물 B]  [식물 C]    │       │
│  │    이름      이름      이름       │       │
│  │  [상세][상담] (zIndex:10)         │       │
│  └───────────────────────────────── ┘       │
│  [잔디+흙: position:absolute, bottom:0,      │
│   zIndex:1, pointerEvents:none, height:52px] │
└─────────────────────────────────────────────┘
```

**핵심**: 잔디/흙 `zIndex:1`, 식물 레이블/버튼 `zIndex:10` → 버튼이 잔디 위에 표시됨

### 9.3 봉우리 슬롯 좌표

```typescript
const SLOTS = [
  { x: 28, y: 12 }, { x: 108, y: 12 },  // 상단 가지 끝
  { x: 20, y: 56 }, { x: 116, y: 56 },  // 중단 가지 끝
  { x: 32, y: 108 }, { x: 104, y: 108 } // 하단 가지 끝
];
// 배치: left = slot.x * scale - meta.ax * scale (center anchor)
```

---

## 10. 디자인 시스템 (globals.css)

### 10.1 팔레트

| 토큰 | Light | Dark | 용도 |
|------|-------|------|------|
| `--bg` | #F5F2EB (크림) | #1A1D16 | 기본 배경 |
| `--bg-sidebar` | #3D4A30 (다크 올리브) | #2A3520 | 사이드바 |
| `--fg` | #2A2A2A | #E8E4DB | 기본 텍스트 |
| `--accent` | #5C6B3F (올리브) | #8BA05A | 강조 |
| `--bg-elevated` | #FFFFFF | #252820 | 카드 배경 |
| `--border` | rgba(0,0,0,0.08) | rgba(255,255,255,0.08) | 테두리 |

### 10.2 주요 CSS 클래스

| 클래스 | 용도 |
|--------|------|
| `.card` | 카드 컨테이너 |
| `.card-hover` | hover lift 효과 |
| `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost` | 버튼 변형 |
| `.btn-sm`, `.btn-lg` | 버튼 크기 |
| `.input` | 인풋 스타일 |
| `.t-display`, `.t-h1`~`.t-h3`, `.t-body`, `.t-caption` | 타이포그래피 |
| `.animate-in`, `.stagger` | 등장 애니메이션 |
| `.pill-*` | 상태 pill 배지 |
| `.bud-tooltip` | 봉우리 hover 툴팁 |

---

## 11. 세션별 주요 변경 이력

### 세션 1–3 (초기 MVP)
- FastAPI 백엔드 전체 (8 라우터, 15 스킬, ReAct 루프)
- Next.js 프론트엔드 (인증, 홈, 식물, 설정, 캘린더)
- 픽셀아트 정원, 캐러셀, 봉우리 슬롯
- 크림/올리브 팔레트 디자인

### 세션 4 (문서화 + 버그 수정, 2026-05-27)
- 방향키 딜레이 버그 수정 (setTimeout → useEffect 분리)
- requirements.txt, README.md 정비
- CLAUDE.md 작성

### 세션 5 (UI 개선 + 히스토리, 2026-05-28)
- BudDetailDrawer z-index 충돌 수정 (ChatPanel 동시 열기 가능)
- ChatPanel 드래그 리사이즈 핸들 (280~700px, persist)
- 브레드크럼 행에 "온라인" 세션 표시 이동
- 대화 기록 브라우저 (`/history`) 2-패널 전체 구현
- 히스토리 트리 이모지 제거, 고정 높이 스크롤 수정
- AI 봉우리 탐색 버그 수정 (prompt rules + list_buds description)
- ChatPanel "새 대화" 구분선 제거
- SKILL_INVALIDATIONS에 "briefing" 추가
- BudDetailDrawer 쿼리 키 `QK.bud()` 정규화
- 백엔드 GET /conversations/list 엔드포인트 추가

### 세션 6 (성능 최적화, 2026-05-28)
- 레이아웃 레벨 prefetchAll() 구현
- 모든 페이지 `enabled: !!accessToken` 가드 적용
- ChatPanel 브레드크럼 useQuery로 교체 (캐시 즉시 조회)
- 캘린더 인접 월 프리페치
- 히스토리 트리 hover 프리페치
- QK.bud() 사용으로 쿼리 키 완전 정규화

---

## 12. 환경 구성

### 12.1 백엔드 (backend/.env)

```dotenv
DATABASE_URL=sqlite:///./plant_counselor.db
JWT_SECRET=<32자 이상 랜덤 문자열>
JWT_ACCESS_TTL=15
JWT_REFRESH_TTL=14
LLM_API_KEY=<Gemini API Key from AI Studio>
KEY_ENCRYPTION_SECRET=<32자 이상 랜덤 문자열>
CORS_ALLOW_ORIGIN=http://localhost:3000
```

### 12.2 실행 순서

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

## 13. 미완성 / 향후 개선 사항

### 즉시 가능한 개선

| 항목 | 현재 상태 | 개선 방향 |
|------|-----------|-----------|
| detail 시간 파싱 | 문자열 그대로 저장 | "오후 1시" → HH:MM 정규화 |
| 봉우리 직접 수정 | 드로어에서 제목/메모 편집 없음 | PATCH /buds/{id} 폼 추가 |
| 식물 편집 | 이름/설명 편집 UI 없음 | 상세 페이지 inline 편집 |
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

## 14. 기술 결정 요약

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
| QK 팩토리 패턴 | 모든 페이지에서 동일 캐시 키 보장 |
| enabled: !!accessToken | 콜드 스타트 401 재시도 이중 요청 제거 |
| 레이아웃 prefetchAll | 인증 직후 핵심 데이터 사전 로드 → 페이지 이동 딜레이 제거 |
| detail 필드에 시간 저장 | DB 마이그레이션 없이 시간 정보 표현 (MVP 타협) |
| 크림/올리브 팔레트 | ref_images 기반 — 따뜻한 정원 분위기 |
| setTimeout 제거 | state update + DOM effect 분리 → useEffect 사용 |
| chatWidth persist | 사용자가 조정한 채팅 패널 폭 새로고침 후에도 유지 |
