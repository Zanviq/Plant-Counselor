# AI Skill 개요

> 최종 점검: 2026-06-02

관련 문서: [[Web/03_LLM/LLM_흐름]], [[Web/03_LLM/시스템_프롬프트]],
[[Web/05_백엔드/AI_연동]]

AI 정원사는 Gemini function calling으로 등록된 스킬을 ReAct 루프 안에서 연속
실행한다. 기본 최대 단계는 10이며 런타임 설정으로 변경할 수 있다.

## 등록된 스킬 20개

```text
think
match_plant
create_plant
delete_plant
create_bud
update_bud_status
update_bud_progress
set_deadline
abandon_bud
harvest_bud
list_plants
list_buds
get_statistics
get_garden_briefing
search_conversation
suggest_scope_change
create_calendar_event
list_calendar_events
update_calendar_event
delete_calendar_event
```

## 등록과 권한

- 등록 진입점: `backend/app/routers/chat.py`의 `_build_registry()`
- 카탈로그 변환: `backend/app/ai/skill_registry.py`
- 스코프별 권한: `backend/app/ai/permissions.py`
- 시스템 프롬프트: `backend/app/ai/prompt_builder.py`

| 스코프 | 기존 데이터 변경 범위 |
| --- | --- |
| `global` | 전체 식물, 봉우리, 독립 일정 |
| `plant` | 해당 식물과 하위 봉우리 |
| `bud` | 해당 봉우리 |
| `calendar` | 독립 일정 전체. 봉우리는 생성과 조회만 허용 |

스킬을 추가하거나 제거하면 프론트 `ChatPanel.tsx`의 스킬 안내와 mutation 이후 query
cache invalidation도 함께 확인한다.

## 스킬 추가 체크리스트

1. `backend/app/ai/skills/`에 구현한다.
2. `backend/app/routers/chat.py`의 `_build_registry()`에 등록한다.
3. 필요한 프롬프트 규칙을 `prompt_builder.py`에 반영한다.
4. 스코프 제약이 있으면 `permissions.py`를 수정한다.
5. 프론트 `ChatPanel.tsx`의 `SKILLS_INFO`를 수정한다.
6. 변이 스킬이면 `SKILL_INVALIDATIONS`를 수정한다.
7. `docs/DEMO_GUIDE.md`의 시나리오와 스킬 목록을 갱신한다.
