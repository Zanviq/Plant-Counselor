# 02. UI 페이지 & 컴포넌트

각 페이지/컴포넌트의 책임·상태·핵심 인터랙션·의존성을 정리합니다.

---

## 페이지

### 로그인 (`app/(auth)/login/page.tsx`)

- **목적**: 가입·로그인 단일 페이지. `mode` 상태로 토글.
- **데이터**: 자체 폼 상태. 마운트 시 `configureClient()` 만 호출.
- **검증**: 비밀번호 일치 + 4자 이상. 백엔드 에러는 그대로 표시.
- **성공 시**: `setSession(token, user)` → `router.replace("/")`.

### 홈 (`app/(app)/page.tsx`)

- **블록**: 인삿말 + 브리핑 → 통계 4카드 → 식물 보드(최대 5개 + "+새 식물" CTA) → 시들 봉우리(최대 6개).
- **데이터**: `summary`, `briefing`, `plants`, `buds` 4개 쿼리. `enabled: !!accessToken` 가드 적용.
  - wilting은 buds에서 클라이언트 derive (중복 페치 제거).
- **성능**: 레이아웃 `prefetchAll()`로 토큰 확보 즉시 캐시 워밍 → 이 페이지 스켈레톤 없음.
- **API 키 가드**: 브리핑에 "API 키" + "설정" 포함 시 노란 안내 배너.
- **클릭 동선**:
  - 통계 카드 → 해당 페이지로 라우팅
  - 식물 카드 → `/plants/[id]`
  - 카드 상담 버튼 → 식물 스코프로 채팅 열기
  - 시들 봉우리 상담 → 봉우리 스코프로 채팅 열기

### 정원 (`app/(app)/plants/page.tsx`)

- **컴포넌트**: `GardenPlant`(벡터 픽셀아트, `components/plants/GardenPlantVisual.tsx`), `PlantCard`(리스트), `StatusBar`, `ViewToggle`, `GardenZoomControl`.
- **상태**: `view`(garden/list), `query`(검색), `selectedIdx`(보드 위치), `gardenZoom`, 그리고 수확 바구니용 `basketOpen` / `selectedFruitPlantIds` / `basketSearch` / `historyFruit`.
- **`GardenPlantVisual`**: 화분·줄기·잎·봉우리(꽃/열매/시듦)를 `Pixel` 사각형으로 그리는 벡터 그래픽. 줌(0.5~2x)·스크롤 가능한 보드 위에 배치.
- **`dominantStatus()`** (`lib/status.ts`): 가장 "성장한" 상태를 카드의 상태 뱃지에 표시. 단계: 봉우리→꽃→열매→수확 / 시듦→썩음 (씨앗 단계는 migration 004로 제거, `normalizeBudStatus`로 읽기 호환).
- **우측 상단 AI 대화 버튼**: 다른 페이지처럼 `openWith()`로 전역 채팅 열기 (리스트 뷰는 툴바 우측).
- **수확 바구니** (`GardenHarvestBasket`):
  - 화분 리스트의 **가장 왼쪽 슬롯**에 배치된 줄무늬 짜임 바구니(벡터). 화분과 같은 baseline에 정렬.
  - 모든 식물의 **수확(harvested) 열매를 화분에서 빼서** 바구니 입구에 실제로 쌓아 표시(앞/뒤 2열, `+N` 오버플로 배지). 각 열매에 원래 식물 이름 라벨.
  - 바구니 클릭 → 우측 사이드바(`BasketSidebar`): 검색 + 식물 라벨 칩(다중 선택) → 선택 식물 열매만 목록 표시, 바구니 속 다른 식물 열매는 불투명 처리.
  - 열매 클릭(바구니/사이드바) → `FruitHistoryPopup`: 그 봉우리 과거 대화 기록(`getHistory("bud", id)`) 모달, **추가 대화 입력 없음**.
- **시듦 = 갈색**: `--st-wilting`/픽셀 시듦 색을 갈색으로, 식물 전체 시듦(`plant.status==="wilting"`) 시 화분째 갈색 필터 + 라벨 "시듦".
- **정원 뷰 인터랙션**: 화살표 키(←→) 이동, 선택 식물 클릭 → `/plants/[id]`, 비선택 클릭 → 선택, Enter → 상세 이동. Ctrl+휠 줌.
- **`enabled: !!accessToken`** 가드 적용.

### 식물 상세 (`app/(app)/plants/[id]/page.tsx`)

- **헤더 카드**: 이름·설명·통계(활성/수확/포기) + "이 식물 상담" + 삭제 (2단계 확인).
- **봉우리 목록**: `BudRow` (상태 pill, 진행 막대, 마감일). `enabled: !!accessToken` 가드.
- **필터**: 전체/진행 중/완료.
- **`initialData`**: `QK.plants()` 캐시에서 즉시 식물 헤더 렌더 (목록 캐시 재사용).
- **`BudDetailDrawer`**:
  - 봉우리 행 클릭 시 우측에서 슬라이드 인.
  - ChatPanel이 열려있으면 `right: chatWidth`로 함께 이동.
  - 자체 z-index: 45 (ChatPanel z:40보다 위, 백드롭 z:39).
  - 쿼리 키: `QK.bud(budId)` (ChatPanel과 동일 캐시 항목 공유).
  - 진행 막대·메타 4그리드·이력 타임라인.
  - **빠른 액션** (footer): "+20%", "수확", "포기" → `CustomEvent("pc-chat-prompt")` → ChatPanel 자동 전송.

### 캘린더 (`app/(app)/calendar/page.tsx`)

- **레이아웃**: 좌측 캘린더 카드 + 우측 오늘/AI 제안 패널.
- **그리드 셀**: 일자 + 이벤트 도트(최대 3) + "+N" 카운트.
- **`enabled: !!accessToken`** 가드 적용.
- **인접 월 프리페치**: `useEffect([year, month])` → 이전달·다음달 데이터 미리 로드 → ‹/› 클릭 즉시 표시.
- **이전/다음 달**: 월 0→11 wrap 처리.
- **선택된 날짜**: 그리드 하단 별도 카드로 이벤트 리스트 펼침.
- **캘린더 AI 대화**: `openWith({ kind: "calendar" })` → 일정 전용 AI 채팅.

### 대화 기록 (`app/(app)/history/page.tsx`)

- **목적**: 모든 대화 스레드를 계층적으로 탐색하고 내용을 열람.
- **레이아웃**: `height: 100vh` + `flex: 1` + `minHeight: 0` → 내부 패널 독립 스크롤.
- **좌측 트리 패널** (280px):
  - 키워드 필터 인풋 (제목, 마지막 메시지, 식물명 대상)
  - `buildTree()` 결과를 `TreeRow`로 렌더
  - 계층: global(indent 0) → calendar(0) → 식물(1) → 봉우리(2)
  - 사라진 봉우리(disappeared_at): opacity 0.55 dimmed
  - ghost 식물 헤더: 봉우리 대화는 있지만 식물 대화 없을 때 — 클릭 불가
  - hover → `prefetchThread(item)` 호출로 스레드 미리 로드
- **우측 스레드 패널**:
  - `ScopeTag`: 식물명 chip + 봉우리명 chip (이모지 없음, 텍스트만)
  - 스레드 내 검색 (form submit → `searchConversation()`)
  - 메시지 목록: `MessageBubble` (user/assistant만, tool 제외)
  - 자동 스크롤 to bottom on load
  - "이 대화 이어가기" → `openWith(scope)` + `router.push(해당 페이지)`
- **`enabled: !!accessToken`** 가드 적용 (conversations, plants, buds 쿼리).
- **사이드바 링크**: "대화 기록" + hover 시 `QK.conversations()`, `QK.plants()`, `QK.buds()` 프리페치.

### 설정 (`app/(app)/settings/page.tsx`)

5개 탭:

| 탭 | 항목 |
|----|------|
| 계정 | 닉네임 표시, 비밀번호 변경, 로그아웃 |
| AI | Gemini API 키(암호화 저장), 응답 톤 3종 |
| 정원 규칙 | wilting_days, rot_disappear_days, deadline_warn_days — `NumberStepper` |
| 테마 | 모드(light/dark/system) + 강조색(emerald/sapphire/violet/sunset) |
| 정보 | 버전·데이터 정책·만든 곳 |

- **`NumberStepper`**: −/+ 28px 버튼, tabular-nums.
- **알림**: 3초 자동 사라지는 상단 toast.

---

## 공용 컴포넌트

### `components/layout/Sidebar.tsx`

- **너비 56px**. 로고 → 5개 nav(홈/정원/캘린더/대화기록/…) → 구분선 → AI 정원사 토글 → footer(알림·설정·아바타).
- **툴팁**: hover 시 우측에 검정 배경 칩으로 라벨 노출. CSS 전용.
- **알림 배지**: 빨간 9+ 표시. `useQuery({queryKey: QK.notifications(), refetchInterval: 30s})`.
- **알림 popover**: `NotificationsPopover`가 사이드바 옆 fixed 위치.
- **hover 프리페치**:
  - `/plants` 링크: `QK.plants()`, `QK.buds()` 프리페치
  - `/calendar` 링크: `QK.calendar()`, `QK.summary()`, `QK.briefing()` 프리페치
  - `/history` 링크: `QK.conversations()`, `QK.plants()`, `QK.buds()` 프리페치

### `components/layout/NotificationsPopover.tsx`

- **데이터**: `listNotifications()` 결과를 시간 역순으로 표시.
- **종류별 색**: bud_rot=danger, bud_wilting=warning, deadline_warning=info.
- **닫기**: 외부 클릭(`mousedown`) 또는 Escape.
- **모두 읽음**: `Promise.all`로 일괄 ack.

### `components/chat/ChatPanel.tsx`

- **폭**: 기본 400px, 드래그 리사이즈 (min 280px ~ max 700px, localStorage persist).
- **드래그 핸들**: 5px 왼쪽 가장자리, `col-resize` 커서, hover 시 accent 색.
- **위치**: `position: fixed`, `right: 0`, `zIndex: 40`.
- **레이아웃 shift**: 열릴 때 `<main>` `marginRight: chatWidth`로 본문 밀림.
- **스코프 브레드크럼**: `useQuery(QK.plant/QK.bud)` 기반으로 캐시에서 즉시 이름 표시.
  - 이전 방식(`useEffect + 직접 fetch`) → 현재(`useQuery` 캐시 조회)
- **헤더 구조**:
  - Row 1: 브레드크럼 + "온라인" 세션 배지 + 닫기(✕)
  - Row 2: 채팅 아이콘 + "AI 정원사" 타이틀
- **상태**:
  - `messages` (서버 이력 + 현재 세션 신규)
  - `historyLoaded` (이력 로드 완료 플래그)
  - `input`, `showPalette`, `paletteIdx`
  - `dirtySkills` (ref Set) — 응답 종료 시 invalidate 대상 결정
- **명령어 팔레트**: `input.startsWith("/")` 시 풀필터링. 키보드 ↑↓/Tab/Enter/Esc.
- **메시지 렌더**:
  - assistant/user → 말풍선
  - system + kind="plants_list" → 인라인 식물 목록 카드
  - system + kind="skills_list" → 스킬 카탈로그
  - system + kind="cmd_result" → 회색 알림 박스
- **외부 자동 전송**: `window.addEventListener("pc-chat-prompt", ...)` → BudDetailDrawer 빠른 액션에서 dispatch.
- **SKILL_INVALIDATIONS**:

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

---

## 디자인 시스템 적용 원칙

- **자체 컴포넌트는 만들지 않음** — Tailwind v4 + CSS 변수 토큰 + 클래스명(`btn`, `card`, `input`, `pill`...)으로만.
- **색은 모두 토큰 참조** — 직접 hex 값 사용 금지.
- **status는 단일 소스**(`lib/status.ts`) — 라벨/색/pill 클래스 모두 여기서.
- **모든 페이지 max-width** — 홈/정원/캘린더 1120–1200px, 식물 상세 960px, 설정 960px.
- **이모지 사용 금지** — UI 전반에 이모지 없음. (ChatPanel 식물 목록의 🌿 한정 예외)
