# Multi-Step AI Orchestrator Design

**Date:** 2026-05-24  
**Status:** Approved  
**Scope:** `backend/app/ai/chat_orchestrator.py`, `prompt_builder.py`, new `skills/think.py`

## Problem

Current orchestrator supports at most 1 skill call per conversation turn:
- LLM call 1 → optional single skill → LLM call 2 (final response)
- Complex requests like "create 3 plants and add buds to each" silently fail or require multiple user turns.

## Solution: ReAct Loop + Think Skill

Replace the fixed 1-or-2 LLM call structure with a `for step in range(MAX_STEPS)` loop that accumulates tool exchanges into a working history, allowing the LLM to chain arbitrarily many skills per turn.

Add a `think` pseudo-skill so the LLM can explicitly reason before acting on complex requests.

## Architecture

```
User input
    ↓
Build initial history (DB history + current message)
    ↓
[ReAct Loop — max 10 steps]
    ├─ LLM call (working_history, catalog, system)
    │       ├─ returns tool_use=think(reasoning)
    │       │       → append tool_use + tool_result to working_history
    │       │       → SSE: tool_call / tool_result
    │       │       → continue loop
    │       │
    │       ├─ returns tool_use=<any skill>
    │       │       → dispatch skill
    │       │       → append tool_use + tool_result to working_history
    │       │       → SSE: tool_call / tool_result
    │       │       → continue loop
    │       │
    │       └─ returns text (no tool_use)
    │               → break loop
    │
    └─ [if MAX_STEPS reached with no text]
            → one final LLM call (no tools) for summary
    ↓
Stream final text tokens via SSE
Save assistant response to conversation DB
```

## Components

### 1. `chat_orchestrator.py` — ReAct loop

```python
MAX_STEPS = 10

working_history = list(history)   # copy; grows with each tool exchange
last_tool_use = None
response_text = ""

for step in range(MAX_STEPS):
    result = llm.chat(working_history, catalog, system)
    text = result.get("text", "")
    tool_use = result.get("tool_use")

    # Retry once on empty response
    if not text and not tool_use:
        result = llm.chat(working_history, catalog, system)
        text = result.get("text", "")
        tool_use = result.get("tool_use")

    rec.log_llm_call / log_llm_result (step + 1, ...)

    if tool_use:
        skill_result = registry.dispatch(tool_use["name"], tool_use["input"], ctx)
        # SSE yield tool_call + tool_result
        working_history += [
            {"role": "assistant", "content": [tool_use_block]},
            {"role": "user",      "content": [tool_result_block]},
        ]
        last_tool_use = tool_use
        continue

    response_text = text
    break

# If loop exhausted without text → one final call, no tools
if not response_text:
    result = llm.chat(working_history, [], system)
    response_text = result.get("text", "")

# Stream tokens, save to DB
```

### 2. `skills/think.py` — planning pseudo-skill

```python
class ThinkSkill(SkillBase):
    name = "think"
    description = """복잡한 작업 전에 사고 과정을 정리하는 스킬.
실제 데이터를 변경하지 않으며, 작업 계획 수립에만 사용합니다.
여러 스킬을 순서대로 실행해야 할 때 먼저 호출하세요."""

    input_schema = {
        "type": "object",
        "properties": {
            "reasoning": {
                "type": "string",
                "description": "수행할 작업 계획과 이유"
            }
        },
        "required": ["reasoning"]
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        return SkillResult(
            ok=True,
            message="사고 완료",
            data={"reasoning": args.get("reasoning", "")}
        )
```

### 3. `prompt_builder.py` — multi-step guidance addition

Add to the "행동 원칙" section:

```
### 복합 작업
여러 스킬이 필요한 작업은 스킬을 연속 호출하여 한 번의 응답에서 완료한다.
복잡하거나 단계가 많은 작업은 먼저 think 스킬로 실행 계획을 수립한 뒤 진행한다.
이전 스킬 결과(plant_id 등)를 즉시 다음 스킬 인수로 활용한다.
예시:
- "취업·건강 식물 만들고 각각 봉우리 추가" → think → create_plant(취업) → create_plant(건강) → create_bud(취업 plant_id) → create_bud(건강 plant_id)
- "정원 현황 분석 후 시들고 있는 봉우리 모두 처리" → get_garden_briefing → list_buds → update_bud_status×N
```

## Error Handling

| Scenario | Behavior |
|---|---|
| Skill `ok=False` | Append error result to history; LLM decides whether to retry or report |
| Empty LLM response | Retry once with same history |
| Loop exhausted (10 steps) | Force final LLM call with no tools for summary |
| think skill called | Always ok=True, no side effects |

## Constraints

- `MAX_STEPS = 10` — prevents runaway cost; covers ~5 skill chains (each needs 1 call to decide + execute)
- `catalog` (tool list) provided on every loop iteration — LLM can call tools at any step
- `working_history` grows linearly; old DB history (limit=20) + up to 10 tool exchanges
- Final DB save stores only the assistant's last text response (unchanged from current behavior)

## Files Changed

| File | Change |
|---|---|
| `app/ai/chat_orchestrator.py` | Replace fixed 2-call structure with ReAct loop |
| `app/ai/skills/think.py` | New pseudo-skill for planning |
| `app/ai/prompt_builder.py` | Add multi-step / think guidance |
| `app/main.py` or skill registration | Register ThinkSkill |
