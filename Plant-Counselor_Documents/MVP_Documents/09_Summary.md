# Plant Counselor MVP — 전체 요약 및 핵심 흐름

이 문서는 Plant Counselor MVP의 **모든 기능**과 **동작 흐름**을 한 문서에서 파악할 수 있도록 작성되었습니다.

---

## 1. 서비스 한 줄 요약

**"고민과 일정을 AI 정원사와 함께 식물로 가꾸는 웹 서비스."**

사용자가 자연어로 말하면 AI가 자동으로 식물(분야)을 만들고, 봉우리(고민/일정)를 추가하고, 진행 상황을 추적합니다.

---

## 2. 전체 기능 목록

### 2.1 인증

| 기능 | 설명 | 엔드포인트 |
|------|------|-----------|
| 회원가입 | 닉네임 + 비밀번호(Argon2 해시) | POST /auth/signup |
| 로그인 | 액세스 토큰(15분) 반환 + 리프레시 토큰(14일) 쿠키 | POST /auth/login |
| 자동 갱신 | 401 시 리프레시로 액세스 재발급 → 같은 요청 재시도 | POST /auth/refresh |
| 로그아웃 | 리프레시 쿠키 삭제 | POST /auth/logout |
| 비밀번호 변경 | 기존 비밀번호 확인 후 변경 | POST /me/password |
| 계정 삭제 | 닉네임 재입력 확인 후 삭제 | DELETE /me |

### 2.2 식물 관리

| 기능 | 설명 | 흐름 |
|------|------|------|
| 식물 생성 | AI 대화로 분야 자동 추론 → match_plant → create_plant | "취업 고민이 있어" → match_plant("취업") → create_plant("취업") |
| 식물 목록 | 정렬(최근활동/활성순/생성순) + 검색 | GET /plants?sort=activity |
| 식물 상세 | 통계(활성/수확/포기 카운트) + 봉우리 목록 | GET /plants/{id} |
| 식물 삭제 | 보관(soft) 또는 완전삭제(hard) | DELETE /plants/{id}?hard=true |
| 식물 정원 그래픽 | 픽셀아트 스프라이트 + 봉우리 슬롯 시각화 + 가로 캐러셀 | 프론트 전용 |

### 2.3 봉우리(Bud) 관리

| 기능 | 설명 | 흐름 |
|------|------|------|
| 봉우리 생성 | AI가 타입(concern/schedule)·마감일 자동 결정 | "내일 면접 있어" → create_bud(type="schedule", deadline=내일) |
| 진행률 업데이트 | 0~100%, 30/60/85% 임계에서 자동 상태 전이 | update_bud_progress(bud_id, 70) → 상태 flower로 자동 변경 |
| 상태 변경 | 7가지 상태 간 수동/자동 전환 | update_bud_status(bud_id, "fruit") |
| 수확(완료) | 봉우리 완료 처리 | harvest_bud(bud_id) |
| 포기 | 봉우리 포기 처리 → rot 상태 | abandon_bud(bud_id) |
| 마감일 설정 | YYYY-MM-DD 형식 | set_deadline(bud_id, "2026-06-15") |
| 봉우리 상세 드로어 | 진행률·메타·이력 타임라인 + 빠른 액션 | 프론트: 봉우리 행 클릭 → 우측 슬라이드 |
| 자동 시들/썩음 | 10분 주기 스케줄러가 방치된 봉우리 자동 전이 + 알림 | TransitionService.scan_all() |

### 2.4 AI 채팅 시스템

| 기능 | 설명 |
|------|------|
| 자연어 대화 | 한국어 자유 발화 → AI가 의도 파악 후 스킬 자동 호출 |
| 멀티스텝 실행 | 한 발화로 최대 10개 스킬 연속 실행 (ReAct 패턴) |
| 질문 금지 | AI가 확인 질문 없이 자동 판단·처리 |
| 4가지 대화 스코프 | 전체(global), 식물(plant), 봉우리(bud), 캘린더(calendar) |
| 7가지 명령어 | /clear, /compact, /plants, /new, /settings, /skills, /use |
| SSE 스트리밍 | 토큰 단위 실시간 응답 + 스킬 호출 알림 |
| 자동 캐시 갱신 | 스킬 실행 후 관련 쿼리 자동 무효화 |

#### 15개 AI 스킬 상세

| # | 스킬명 | 카테고리 | 파라미터 | 반환값 | 용도 |
|---|--------|----------|----------|--------|------|
| 1 | think | 계획 | reasoning(string) | reasoning 기록 | 복잡 작업 전 사고 정리 |
| 2 | match_plant | 조회 | query(string) | matches[] | 기존 식물 중복 검사 |
| 3 | create_plant | 변경 | name, description | plant_id, name | 새 분야 생성 |
| 4 | delete_plant | 변경 | plant_id, archive? | {} | 식물 삭제/보관 |
| 5 | create_bud | 변경 | plant_id, title, type, detail?, deadline? | bud_id | 봉우리 추가 |
| 6 | update_bud_status | 변경 | bud_id, to_status, reason? | status | 상태 직접 변경 |
| 7 | update_bud_progress | 변경 | bud_id, progress(0-100) | progress, status | 진행률 + 자동 전이 |
| 8 | set_deadline | 변경 | bud_id, deadline(YYYY-MM-DD) | deadline | 마감일 설정 |
| 9 | harvest_bud | 변경 | bud_id, note? | bud_id | 수확(완료) |
| 10 | abandon_bud | 변경 | bud_id, reason? | {} | 포기 |
| 11 | list_plants | 조회 | include_dormant?, sort? | plants[] | 식물 목록 |
| 12 | list_buds | 조회 | plant_id?, status?, type? | buds[] | 봉우리 목록 |
| 13 | get_statistics | 조회 | scope?, plant_id?, period? | stats{} | 통계 데이터 |
| 14 | get_garden_briefing | 조회 | (없음) | briefing(string) | 일일 브리핑 |
| 15 | search_conversation | 조회 | query, scope?, limit? | messages[] | 대화 검색 |

### 2.5 캘린더 & 일정

| 기능 | 설명 |
|------|------|
| 월별 캘린더 | 마감일 있는 봉우리를 이벤트 도트로 표시 |
| 날짜 선택 | 클릭 시 해당 날짜의 일정 목록 펼침 |
| 이벤트 상세 | 제목 + 식물명(badge) + 시간정보(detail) + 타입(일정/고민) |
| 오늘 일정 패널 | 우측에 오늘 마감 일정 표시 |
| AI 일정 제안 | 정원 상태 기반 일일 브리핑 |
| 캘린더 전용 채팅 | "일정 AI와 대화" 버튼 → calendar 스코프 채팅 |
| 빠른 일정 추가 | "+ 일정 추가" 버튼 → AI 채팅으로 자동 처리 |
| 일정 자동 생성 | "오늘 오후 1시에 도호랑 밥먹기" → AI가 식물 자동 매칭 → create_bud(type=schedule) |

### 2.6 알림

| 기능 | 설명 |
|------|------|
| 봉우리 시들 알림 | wilting_days 동안 활동 없으면 알림 생성 |
| 봉우리 썩음 알림 | 시든 후 rot_disappear_days 경과 시 알림 |
| 마감 임박 알림 | deadline_warn_days 이내 마감 봉우리 알림 |
| 사이드바 배지 | 안 읽은 알림 수 표시 (실시간 30초 폴링) |
| 팝오버 | 알림 클릭 → 목록 표시, 읽음/모두읽음 처리 |

### 2.7 테마

| 기능 | 옵션 |
|------|------|
| 모드 | light / dark / system(OS 추종) |
| 강조색 | emerald(기본) / sapphire / violet / sunset |
| 적용 | 즉시 반영, localStorage 영구 저장 |
| Pre-hydration | 첫 페인트 깜빡임 없음 (theme-init.js) |

### 2.8 설정

| 탭 | 항목 |
|----|------|
| 계정 | 닉네임 표시, 비밀번호 변경, 로그아웃 |
| AI | Gemini API 키(Fernet 암호화 저장), 응답 톤(상담사/비서/친구) |
| 정원 규칙 | 시듦 기준 일수(기본 7), 썩음 일수(14), 마감 알림 일수(3) — NumberStepper |
| 테마 | 모드(light/dark/system) + 강조색(4종) — 시각적 프리뷰 카드 |
| 정보 | 버전 v0.1.0, 데이터 정책 |

### 2.9 정원 그래픽 (픽셀아트)

| 요소 | 설명 |
|------|------|
| 식물 스프라이트 | 초록 곡선 줄기 + 둥근 잎 + 화분 합성 이미지 (140×240px) |
| 봉우리 스프라이트 | 6종(seed/sprout/flower/fruit/wilted/harvested), 줄기 없이 요소만 |
| 슬롯 좌표 | 식물당 6개 가지 끝 좌표 — 봉우리 자동 배치 |
| 배경 | 하늘 그라데이션(구름 포함) + 잔디 타일 + 흙 레이어 |
| 인터랙션 | 가로 스크롤 캐러셀, 화살표 키 네비, 선택 강조, 봉우리 hover tooltip |
| 자동 crop | 투명 여백 제거 → 이미지 간 연결 자연스러움 |
| 뷰 토글 | 정원(그래픽) ↔ 리스트(카드 그리드) |

---

## 3. 핵심 동작 흐름

### 3.1 사용자가 "운동 식물 만들고 봉우리 추가해줘" 라고 말하면

```
[1] 사용자 입력: "운동 식물 만들고 봉우리 추가해줘"
     ↓
[2] ChatPanel.sendText() → POST /chat/message (SSE)
     ↓
[3] ChatOrchestrator.run() 시작
     ├── PromptBuilder.build_system() → 시스템 프롬프트 (정원 현황 + 행동 규칙)
     ├── 대화 이력 로드 (limit=20)
     └── ReAct 루프 시작 (MAX_STEPS=10)
     ↓
[4] Step 1: LLM → think("운동 식물 생성 후 봉우리 추가 계획")
     ├── yield "event: tool_call" → 프론트에 표시
     ├── SkillResult(ok=True, message="사고 완료")
     └── yield "event: tool_result"
     ↓
[5] Step 2: LLM → match_plant(query="운동")
     ├── PlantService.find_matches("운동") → [] (없음)
     └── SkillResult(ok=True, matches=[])
     ↓
[6] Step 3: LLM → create_plant(name="운동", description="운동 관련 목표와 할 일")
     ├── PlantService.create() → Plant(id="01KSAR...")
     └── SkillResult(ok=True, plant_id="01KSAR...")
     ↓
[7] Step 4: LLM → create_bud(plant_id="01KSAR...", title="주 3회 운동하기", type="schedule")
     ├── BudService.create() → Bud(id="01KSAS...")
     └── SkillResult(ok=True, bud_id="01KSAS...")
     ↓
[8] Step 5: LLM → 텍스트 응답 "운동 식물을 만들고 '주 3회 운동하기' 봉우리를 추가했어요!"
     ├── yield "event: token" × N (단어별 스트리밍)
     └── yield "event: done"
     ↓
[9] ChatPanel.onDone():
     ├── invalidateQueries(["plants", "buds", "stats"])
     ├── 홈 페이지 카드 자동 갱신
     └── 정원 그래픽 자동 갱신
```

### 3.2 사용자가 "오늘 오후 1시에 도호랑 밥먹기" 라고 캘린더에서 말하면

```
[1] 캘린더 페이지 → "일정 AI와 대화" 클릭 → scope={kind:"calendar"} 채팅 열림
     ↓
[2] 사용자 입력 → current_screen="캘린더"로 SSE 호출
     ↓
[3] AI 판단 (프롬프트의 "일정 생성 규칙"):
     ├── "밥먹기" → 일상 분야로 추론
     ├── "오늘" → 2026-05-24로 변환
     └── "오후 1시" → detail에 포함
     ↓
[4] match_plant("일상") → 매칭 없음
     ↓
[5] create_plant("일상", "일상 생활 일정") → plant_id 획득
     ↓
[6] create_bud(
       plant_id, title="도호랑 밥먹기",
       type="schedule", detail="오후 1시, 도호와 함께",
       deadline="2026-05-24"
     )
     ↓
[7] AI 텍스트: "도호랑 밥먹기 일정을 '일상' 식물에 추가했어요!"
     ↓
[8] 캘린더 자동 갱신:
     ├── 24일에 이벤트 도트 표시
     ├── "오늘 일정" 카드에 "도호랑 밥먹기 | 일상 | 오후 1시" 표시
     └── 통계 "진행 중인 일정" +1
```

### 3.3 봉우리 진행률 변경 → 자동 상태 전이

```
[1] 식물 상세 → 봉우리 드로어 → "+20%" 클릭
     ↓
[2] CustomEvent("pc-chat-prompt") 발생 → ChatPanel에서 수신
     ↓
[3] AI에게 전달: "이 봉우리(id=...) 진행률을 40%로 올려줘"
     ↓
[4] update_bud_progress(bud_id, 40)
     ↓
[5] BudService.update_progress():
     ├── progress = 40 (0~100 클램프)
     ├── 자동 전이 확인: 40 >= 30 → target = "bud"
     ├── 현재 상태 "seed" ≠ "bud" → 전이!
     ├── bud.status = "bud"
     ├── BudHistory 기록: "seed → bud, 진행도 40% 자동 전이"
     └── db.commit()
     ↓
[6] invalidateQueries(["buds"]) → 드로어 갱신
```

### 3.4 자동 시들/썩음 처리 (스케줄러)

```
[1] APScheduler: 10분마다 TransitionService.scan_all(db) 실행
     ↓
[2] 모든 사용자에 대해 scan_user(db, user_id):
     ├── user.garden_rules에서 wilting_days(7), rot_disappear_days(14) 로드
     │
     ├── [자동 전이 1] 활성 봉우리(seed/bud/flower/fruit) 중
     │   last_progress_at이 7일 이상 전인 것:
     │   → status = "wilting"
     │   → BudHistory 기록
     │   → Notification("bud_wilting") 생성
     │
     ├── [자동 전이 2] wilting 상태로 14일 추가 경과:
     │   → status = "rot", disappeared_at = now
     │   → BudHistory 기록
     │   → Notification("bud_rot") 생성
     │
     └── [마감 알림] deadline이 3일 이내인 활성 봉우리:
         → Notification("deadline_warning") 생성
     ↓
[3] 프론트: 30초 refetchInterval로 알림 개수 갱신 → 사이드바 배지 표시
```

### 3.5 테마 전환 흐름

```
[1] 설정 → 테마 탭 → "다크" 클릭
     ↓
[2] themeStore.setMode("dark"):
     ├── document.documentElement.setAttribute("data-theme", "dark")
     ├── Zustand persist → localStorage["pc-theme"] = {mode:"dark", accent:"emerald"}
     └── set({ mode: "dark", resolved: "dark" })
     ↓
[3] CSS: [data-theme="dark"] { --bg: #1A1D16; --fg: #E8E4DB; ... }
     → 모든 var(--*) 참조가 즉시 업데이트
     ↓
[4] 페이지 새로고침 시:
     ├── theme-init.js (beforeInteractive): localStorage에서 mode/accent 읽기
     ├── data-theme/data-accent 즉시 설정 (React 마운트 전)
     └── 깜빡임 없이 올바른 테마 표시
```

---

## 4. 데이터베이스 스키마 요약

| 테이블 | PK | FK | 핵심 컬럼 | 인덱스 |
|--------|----|----|-----------|--------|
| users | id(ULID) | — | nickname(unique), password_hash, tone, garden_rules(JSON), encrypted_api_key | nickname |
| plants | id | user_id→users | name, description, status(active/dormant/archived), stats(JSON) | (user_id,status), (user_id,last_activity_at) |
| buds | id | user_id→users, plant_id→plants | title, detail, type(concern/schedule), status(7종), progress(0-100), deadline(date) | (user_id,status), (user_id,deadline), (plant_id,status) |
| bud_histories | id | bud_id→buds | from_status, to_status, at, reason | (bud_id, at) |
| conversations | id | user_id→users | scope(global/plant/bud/calendar), scope_id | unique(user_id,scope,scope_id) |
| conversation_messages | id | conversation_id→conversations | role, text, skill_call(JSON), at | (conversation_id,at) |
| notifications | id | user_id→users | kind, payload(JSON), acked_at | (user_id,acked_at) |
| garden_states | id | user_id→users | summary_cache(JSON), daily_briefing, daily_briefing_date | unique(user_id) |

---

## 5. API 엔드포인트 전체 목록

모든 엔드포인트는 prefix `/api/v1` 아래에 있으며, 인증이 필요한 것은 Bearer 토큰을 사용합니다.

### 인증 (공개)
```
POST   /auth/signup       {nickname, password}
POST   /auth/login        {nickname, password} → {access_token, user}
POST   /auth/refresh      Cookie: refresh_token → {access_token}
POST   /auth/logout        → Cookie 삭제
```

### 사용자 (인증 필요)
```
GET    /me                 → UserOut
PATCH  /me                 {tone?, garden_rules?, ...} → UserOut
POST   /me/password        {old_password, new_password}
PUT    /me/api-key         {api_key}
DELETE /me                 {confirm_nickname}
```

### 식물 (인증 필요)
```
GET    /plants              ?sort=activity&include_dormant=false → {items: PlantOut[]}
GET    /plants/{id}         → PlantOut
PATCH  /plants/{id}         {name?, description?} → PlantOut
DELETE /plants/{id}         ?hard=false
```

### 봉우리 (인증 필요)
```
GET    /buds                ?plant_id=&wilting_only= → {items: BudOut[]}
GET    /buds/{id}           → {bud: BudOut, history: BudHistoryOut[]}
PATCH  /buds/{id}           {title?, detail?} → BudOut
```

### 통계/캘린더 (인증 필요)
```
GET    /stats/summary       → {active_concerns, active_schedules, harvested_this_month, wilting_count, rot_count, total_plants}
GET    /briefing/today      → {briefing: string}
GET    /calendar            ?from=YYYY-MM-DD&to=YYYY-MM-DD → {events: {date: CalEvent[]}}
```

### 대화 (인증 필요)
```
GET    /conversations/list  → {conversations: ConversationSummary[]}
GET    /conversations       ?scope=&scope_id=&limit= → {messages[]}
POST   /conversations/search {query, scope, scope_id, limit} → {messages[]}
```

### 알림 (인증 필요)
```
GET    /notifications       → {items: Notification[]}
POST   /notifications/{id}/ack
```

### 채팅 (인증 필요, SSE)
```
POST   /chat/message        {text, scope?, scope_id?, current_screen?} → SSE stream
  이벤트: start → (tool_call → tool_result)* → token* → done
```

### 기타
```
GET    /health              → {status: "ok"}  (인증 불필요)
```

---

## 6. 프론트엔드 페이지별 기능 요약

| 페이지 | 경로 | 핵심 기능 |
|--------|------|-----------|
| 로그인 | /login | 가입/로그인 토글, 좌측 브랜드패널(lg+), 우측 폼 |
| 홈 | / | 인사 + 브리핑, 통계 4카드, 식물 보드(최대 5개+CTA), 시듦 봉우리 |
| 정원 | /plants | **정원뷰**(캐러셀+스프라이트) ↔ **리스트뷰**(카드그리드), 검색/정렬 |
| 식물 상세 | /plants/[id] | 헤더카드(통계+삭제), 봉우리 목록(필터), 봉우리 드로어(이력+액션) |
| 캘린더 | /calendar | 월별 그리드, 오늘 일정, AI 제안, "일정 AI와 대화", "+ 일정 추가" |
| 대화 기록 | /history | 2-패널 브라우저, 식물/봉우리 계층 트리, 스레드 열람, "이어가기" |
| 설정 | /settings | 5탭(계정/AI/규칙/테마/정보) |

---

## 7. 채팅 명령어 & 스코프

### 명령어 (/ 로 시작)

| 명령어 | 설명 | 동작 |
|--------|------|------|
| /clear | 기록 삭제 | 현재 화면의 메시지만 비움 (DB 유지) |
| /compact | 대화 요약 | 지금까지 대화를 AI에게 요약 요청 |
| /plants | 식물 보기 | 인라인 식물 목록 카드 표시 |
| /new | 새 봉우리 | AI 안내에 따라 단계별 봉우리 생성 |
| /settings | 설정 | 설정 페이지로 이동 |
| /skills | 스킬 목록 | 15개 AI 스킬 전체 표시 |
| /use <스킬명> | 스킬 실행 | 해당 스킬 직접 실행 |

### 대화 스코프

| 스코프 | 언제 열리는가 | 특징 |
|--------|-------------|------|
| global | 기본(FAB/Space) | 전체 정원 대화, 식물 생성 등 |
| plant | 식물 카드의 "상담" 클릭 | 해당 식물에 대한 대화, 봉우리 생성/관리 |
| bud | 봉우리의 "상담" 클릭 | 해당 봉우리에 대한 상세 대화 |
| calendar | 캘린더의 "일정 AI와 대화" 클릭 | 모든 식물의 일정 조회·생성·수정 |

---

## 8. 기술적 결정 요약

| 결정 | 이유 |
|------|------|
| ULID (정렬 가능 ID) | 시간 순서 보장 + URL safe + 디버깅 용이 |
| Argon2 비밀번호 해시 | GPU 공격에 bcrypt보다 안전 |
| Fernet 암호화 (API 키) | 단일 배포 환경에서 충분, 키 회전 가능 |
| HTTP-only 리프레시 쿠키 | XSS로 토큰 탈취 방지 |
| SQLAlchemy 2.x Mapped | 타입 힌트 친화적, 모던 |
| ReAct 루프 자체 구현 | 외부 의존 최소화, Gemini SDK 직접 매핑 |
| Anthropic 형식 중간 표현 | 향후 멀티-LLM 전환 용이 |
| 동기 SSE 제너레이터 | 동기 SDK·세션과 자연스러움 |
| TanStack Query + Zustand | 캐시·invalidate·전역 상태 통합 |
| Tailwind v4 + CSS 변수 | 빌드 산출물 작고 테마 토큰 재사용 쉬움 |
| 크림/올리브 톤 디자인 | 레퍼런스 이미지 기반 — 따뜻한 정원 분위기 |
| 10분 스케줄러 주기 | 알림 적시성과 서버 부하 균형 |
| detail 필드에 시간 저장 | DB 마이그레이션 없이 시간 정보 포함 (MVP) |

---

## 9. 실행 방법

```bash
# 백엔드
cd backend
pip install -e .
cp .env.example .env   # LLM_API_KEY 등 입력
python run.py           # http://localhost:8000

# 프론트엔드
cd frontend
pnpm install
pnpm dev                # http://localhost:3000

# 스프라이트 재생성
python scripts/generate_pixel_sprites.py
cp assets/sprites/* frontend/public/sprites/
```

### 환경 변수 (.env)

| 키 | 기본값 | 설명 |
|----|--------|------|
| DATABASE_URL | sqlite:///./plant_counselor.db | DB 연결 |
| JWT_SECRET | dev-secret | **prod에서 반드시 교체** |
| LLM_API_KEY | (비움) | 사용자별 키 없을 때 fallback |
| KEY_ENCRYPTION_SECRET | dev-encryption-key-... | API 키 암호화 시크릿 |
| CORS_ALLOW_ORIGIN | http://localhost:3000 | 프론트 도메인 |
