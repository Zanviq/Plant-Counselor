# 02. UI 페이지 & 컴포넌트

각 페이지/컴포넌트의 책임·상태·핵심 인터랙션·의존성을 정리합니다.

---

## 페이지

### 로그인 (`app/(auth)/login/page.tsx`)

- **목적**: 가입·로그인 단일 페이지. `mode` 상태로 토글.
- **데이터**: 자체 폼 상태. 마운트 시 `configureClient()` 만 호출하여 인증되지 않은 fetch 래퍼 동작 보장.
- **검증**: 비밀번호 일치 + 4자 이상. 백엔드 에러는 그대로 표시.
- **레이아웃**: 좌측 브랜드 패널(`hidden lg:flex` 으로 작은 화면에선 숨김) + 우측 폼.
- **성공 시**: `setSession(token, user)` → `router.replace("/")`.

### 홈 (`app/(app)/page.tsx`)

- **블록**: 인삿말 + 브리핑 → 통계 4카드 → 식물 보드(최대 5개 + "+새 식물" CTA) → 시들 봉우리(최대 6개).
- **데이터**: `summary`, `briefing`, `plants`, `buds` 의 4개 쿼리. wilting은 buds에서 클라이언트 derive (중복 페치 제거).
- **API 키 가드**: 브리핑 응답에 "API 키" + "설정" 문자열이 포함되면 노란 안내 배너 표시.
- **클릭 동선**:
  - 통계 카드 → 해당 페이지로 라우팅
  - 식물 카드 → `/plants/[id]`
  - 카드 상담 버튼 → 식물 스코프로 채팅 열기
  - 시들 봉우리 상담 → 봉우리 스코프로 채팅 열기

### 정원 (`app/(app)/plants/page.tsx`)

- **컴포넌트**: `PlantCard`, `StatusBar`, `Stat`, `SortToggle`.
- **상태**: `sort`(activity/active/created), `query`(검색).
- **`StatusBar`**: 봉우리 상태 분포를 7색 stack bar로 시각화. 0개면 빈 트랙.
- **`dominantStatus()`** (`lib/status.ts`): 가장 "성장한" 상태를 카드의 상태 뱃지에 표시.
- **빈 상태**: 점선 카드 + "AI와 시작하기" CTA.

### 식물 상세 (`app/(app)/plants/[id]/page.tsx`)

- **헤더 카드**: 이름·설명·통계(활성/수확/포기) + "이 식물 상담" + 삭제 (2단계 확인).
- **봉우리 목록**: `BudRow` (상태 pill, 진행 막대, 마감일).
- **필터**: 전체/진행 중/완료.
- **`BudDetailDrawer`**: 봉우리 행 클릭 시 우측 슬라이드. 진행 막대·메타 4그리드·이력 타임라인.
- **빠른 액션** (드로어 footer): "+20%", "수확", "포기" — `CustomEvent("pc-chat-prompt")` 로 채팅을 자동 호출.
- **삭제**: 1차 클릭 → 2차 "정말 삭제" → `deletePlant(id, hard=true)` → `/plants` 리다이렉트.

### 캘린더 (`app/(app)/calendar/page.tsx`)

- **레이아웃**: 좌측 캘린더 카드 + 우측 오늘/AI 제안 패널. 하단 4개 통계 카드.
- **그리드 셀**: 일자 + 이벤트 도트(최대 3) + "+N" 카운트.
- **오늘 강조**: 강조색 배경 + accent-fg 텍스트.
- **이전/다음 달**: 월 0→11 wrap 처리.
- **선택된 날짜**: 그리드 하단에 별도 카드로 이벤트 리스트 펼침.
- **백엔드 보호**: `getCalendar(from,to)` 에 from/to ISO 검증, 366일 cap 적용.

### 설정 (`app/(app)/settings/page.tsx`)

5개 탭:

| 탭 | 항목 |
|----|------|
| 계정 | 닉네임 표시, 비밀번호 변경, 로그아웃 |
| AI | Gemini API 키(암호화 저장), 응답 톤 3종 |
| 정원 규칙 | wilting_days, rot_disappear_days, deadline_warn_days — `NumberStepper` |
| 테마 | 모드(light/dark/system) + 강조색(emerald/sapphire/violet/sunset) |
| 정보 | 버전·데이터 정책·만든 곳 |

- **`Radio`, `Check`, `ModeCard`, `AccentCard`**: 일관된 선택 UI 프리미티브.
- **`NumberStepper`**: −/+ 28px 버튼, tabular-nums.
- **알림**: 3초 자동 사라지는 상단 toast.
- **테마 변경**: `setMode/setAccent` 가 `data-theme`/`data-accent` 속성을 즉시 도큐먼트 루트에 반영.

---

## 공용 컴포넌트

### `components/layout/Sidebar.tsx`

- **너비 56px**. 로고 → 4개 nav → 구분선 → AI 정원사 토글 → footer(알림·설정·아바타).
- **툴팁**: hover 시 우측에 검정 배경 칩으로 라벨 노출. CSS 전용.
- **알림 배지**: 빨간 9+ 표시. `useQuery({queryKey:["notifications"], refetchInterval: 60s})`.
- **알림 popover**: `NotificationsPopover` 가 사이드바 옆 fixed 위치에 렌더.

### `components/layout/NotificationsPopover.tsx`

- **데이터**: `listNotifications()` 결과를 시간 역순으로 표시.
- **종류별 색**: bud_rot=danger, bud_wilting=warning, deadline_warning=info.
- **`timeAgo()`**: 60s/60m/24h 기준의 한글 상대시각.
- **닫기**: 외부 클릭(`mousedown`) 또는 Escape.
- **모두 읽음**: `Promise.all` 로 일괄 ack.

### `components/chat/ChatPanel.tsx`

- **고정 폭 400px**, 우측 슬라이드. zIndex 40.
- **스코프 브레드크럼**: 전체 › 식물 › 봉우리 — Crumb 컴포넌트 재사용.
- **상태**:
  - `messages` (서버 이력 + 현재 세션 신규)
  - `historyLoaded` (이력 로드 완료 플래그)
  - `input`, `showPalette`, `paletteIdx`
  - `dirtySkills` (ref Set) — 응답 종료 시 invalidate 대상 쿼리 결정
- **명령어 팔레트**: `input.startsWith("/")` 시 풀필터링. 키보드 ↑↓/Tab/Enter/Esc.
- **메시지 렌더**:
  - assistant/user → 말풍선
  - system + kind="plants_list" → 인라인 식물 목록 카드
  - system + kind="skills_list" → 스킬 카탈로그
  - system + kind="cmd_result" → 회색 알림 박스
- **빈 응답 폴백**: 종료 시 text가 비어있으면 "응답이 비어있어요…" 표시.
- **외부 자동 전송**: `window.addEventListener("pc-chat-prompt", ...)` 로 다른 컴포넌트가 dispatch 시 즉시 sendText.
- **invalidate 매핑**: `SKILL_INVALIDATIONS` 객체 — 스킬명 → 무효화할 쿼리 키. 응답 종료 시 일괄 적용.

---

## 디자인 시스템 적용 원칙

- **자체 컴포넌트는 만들지 않음** — Tailwind v4 + CSS 변수 토큰 + 클래스명(`btn`, `card`, `input`, `pill`...)으로만.
- **색은 모두 토큰 참조** — 직접 hex 값 사용 금지(예외: NotificationsPopover의 종류별 단색).
- **status는 단일 소스**(`lib/status.ts`) — 라벨/색/pill 클래스 모두 여기서.
- **이모지 사용 최소화** — 채팅 인라인 식물 목록은 명확성을 위해 🌿 한정 사용.
- **모든 페이지 max-width** — 홈/정원/캘린더 1120px, 식물 상세 960px, 설정 960px.
