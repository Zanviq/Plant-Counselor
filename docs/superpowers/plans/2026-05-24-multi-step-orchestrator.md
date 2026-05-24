# Multi-Step ReAct Orchestrator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed 1-or-2 LLM call orchestrator with a ReAct loop (max 10 steps) so the AI can chain multiple skills in one turn, plus add a `think` pseudo-skill for planning.

**Architecture:** A `for step in range(MAX_STEPS)` loop accumulates tool exchanges into `working_history`. Each iteration asks the LLM what to do next; if it returns a tool call, the skill is dispatched and the exchange is appended to `working_history` before the next iteration. The loop exits when the LLM returns text with no tool call, or when MAX_STEPS is reached (triggering a forced summary call).

**Tech Stack:** Python 3.11, FastAPI, Gemini via `google-genai`, SQLAlchemy sync, SSE streaming.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `app/ai/skills/think.py` | ThinkSkill pseudo-skill — no side effects, returns reasoning |
| Modify | `app/routers/chat.py` | Register ThinkSkill in `_build_registry()` |
| Rewrite | `app/ai/chat_orchestrator.py` | ReAct loop replacing fixed 2-call structure |
| Modify | `app/ai/prompt_builder.py` | Add multi-step + think usage guidance |

---

## Task 1: Create ThinkSkill

**Files:**
- Create: `app/ai/skills/think.py`

- [ ] **Step 1.1: Write `think.py`**

```python
from __future__ import annotations
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class ThinkSkill(SkillBase):
    name = "think"
    description = (
        "복잡한 작업 전에 사고 과정을 정리하는 스킬. "
        "실제 데이터를 변경하지 않으며, 작업 계획 수립에만 사용합니다. "
        "여러 스킬을 순서대로 실행해야 할 때 먼저 호출하여 계획을 수립하세요."
    )
    parameters = {
        "type": "object",
        "properties": {
            "reasoning": {
                "type": "string",
                "description": "수행할 작업의 계획과 이유를 자세히 서술",
            }
        },
        "required": ["reasoning"],
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        return SkillResult(
            ok=True,
            message="사고 완료",
            data={"reasoning": args.get("reasoning", "")},
        )
```

- [ ] **Step 1.2: Verify the file exists and is importable**

```bash
cd backend
python -c "from app.ai.skills.think import ThinkSkill; s = ThinkSkill(); print(s.name, s.to_tool_spec()['name'])"
```
Expected output: `think think`

- [ ] **Step 1.3: Commit**

```bash
git add app/ai/skills/think.py
git commit -m "feat(ai): add ThinkSkill pseudo-skill for multi-step planning"
```

---

## Task 2: Register ThinkSkill

**Files:**
- Modify: `app/routers/chat.py` — add import and register in `_build_registry()`

- [ ] **Step 2.1: Add import to `app/routers/chat.py`**

After line 23 (`from app.ai.skills.update_bud_status import UpdateBudStatusSkill`), add:

```python
from app.ai.skills.think import ThinkSkill
```

- [ ] **Step 2.2: Add to registry in `_build_registry()`**

Add `ThinkSkill` as the **first** entry in the list (so it appears early in the tool catalog):

```python
def _build_registry() -> SkillRegistry:
    reg = SkillRegistry()
    for skill_cls in [
        ThinkSkill,           # ← add this
        MatchPlantSkill,
        CreatePlantSkill,
        DeletePlantSkill,
        CreateBudSkill,
        UpdateBudStatusSkill,
        UpdateBudProgressSkill,
        SetDeadlineSkill,
        AbandonBudSkill,
        HarvestBudSkill,
        ListPlantsSkill,
        ListBudsSkill,
        GetStatisticsSkill,
        GetGardenBriefingSkill,
        SearchConversationSkill,
    ]:
        reg.register(skill_cls())
    return reg
```

- [ ] **Step 2.3: Verify registration**

```bash
cd backend
python -c "
from app.routers.chat import _registry
names = [s.name for s in _registry.list()]
print(names)
assert 'think' in names, 'ThinkSkill not registered'
print('OK — think registered, total skills:', len(names))
"
```
Expected: prints list including `'think'`, total 15 skills.

- [ ] **Step 2.4: Commit**

```bash
git add app/routers/chat.py
git commit -m "feat(ai): register ThinkSkill in chat router"
```

---

## Task 3: Rewrite ChatOrchestrator with ReAct Loop

**Files:**
- Rewrite: `app/ai/chat_orchestrator.py`

- [ ] **Step 3.1: Replace the entire file with the ReAct loop implementation**

```python
from __future__ import annotations
import json

from app.ai.log_recorder import LogRecorder
from app.ai.skill_base import SkillContext

MAX_STEPS = 10


class ChatOrchestrator:
    def __init__(self, llm_client, skill_registry, prompt_builder, services: dict):
        self.llm = llm_client
        self.registry = skill_registry
        self.builder = prompt_builder
        self.services = services

    def run(
        self,
        user_id: str,
        text: str,
        scope: str,
        scope_id,
        current_screen: str,
        db,
    ):
        """동기 제너레이터: SSE 이벤트 문자열을 yield합니다."""
        rec = LogRecorder(user_id, text)
        rec.log_event("start", f"scope={scope} screen={current_screen}")

        plant_svc = self.services.get("plant")
        bud_svc = self.services.get("bud")
        gs_svc = self.services.get("garden_state")
        conv_svc = self.services.get("conversation")

        ctx = SkillContext(
            user_id=user_id,
            db=db,
            plant_service=plant_svc,
            bud_service=bud_svc,
            garden_state_service=gs_svc,
            conversation_service=conv_svc,
        )

        stats = gs_svc.get_summary(user_id) if gs_svc else {}
        plants = plant_svc.list(user_id) if plant_svc else []
        system = self.builder.build_system(ctx, current_screen, stats, plants)
        rec.set_system(system)

        # 히스토리 조합
        history: list[dict] = []
        if conv_svc:
            msgs = conv_svc.get_history(user_id, scope, scope_id, limit=20)
            for m in msgs:
                if m.role in ("user", "assistant"):
                    history.append({"role": m.role, "content": m.text})
        history.append({"role": "user", "content": text})
        rec.set_history(history)

        if conv_svc:
            conv_svc.append(user_id, scope, scope_id, "user", text)

        yield f"event: start\ndata: {json.dumps({'message_id': 'msg_1'})}\n\n"

        catalog = self.registry.build_catalog()
        working_history = list(history)
        response_text = ""
        last_tool_use = None

        # ── ReAct ループ ──────────────────────────────────────────────
        for step in range(MAX_STEPS):
            rec.log_llm_call(step + 1, working_history, len(catalog))
            rec.log_event(f"llm_call_{step + 1}", f"tools={len(catalog)}")

            result = self.llm.chat(working_history, catalog, system)
            response_text = result.get("text", "")
            tool_use = result.get("tool_use")

            # 빈 응답 재시도 (1회)
            if not response_text and not tool_use:
                result = self.llm.chat(working_history, catalog, system)
                response_text = result.get("text", "")
                tool_use = result.get("tool_use")
                rec.log_event(
                    f"llm_retry_{step + 1}",
                    f"text_len={len(response_text)} tool={tool_use['name'] if tool_use else None}",
                )

            rec.log_llm_result(step + 1, response_text, tool_use)
            rec.log_event(
                f"llm_result_{step + 1}",
                f"text_len={len(response_text)} tool={tool_use['name'] if tool_use else None}",
            )

            if tool_use:
                last_tool_use = tool_use
                yield f"event: tool_call\ndata: {json.dumps({'name': tool_use['name'], 'args': tool_use['input']})}\n\n"

                skill_result = self.registry.dispatch(tool_use["name"], tool_use["input"], ctx)
                rec.log_skill(
                    tool_use["name"], tool_use["input"],
                    skill_result.ok, skill_result.message, skill_result.data,
                )
                rec.log_event(
                    f"skill_{step + 1}",
                    f"{tool_use['name']} ok={skill_result.ok} msg={skill_result.message}",
                )

                yield (
                    f"event: tool_result\ndata: "
                    f"{json.dumps({'name': tool_use['name'], 'result': {'ok': skill_result.ok, 'message': skill_result.message, 'data': skill_result.data}})}\n\n"
                )

                # 스킬 교환을 working_history에 추가
                working_history.append({
                    "role": "assistant",
                    "content": [
                        {
                            "type": "tool_use",
                            "id": tool_use.get("id", f"tool_{step}"),
                            "name": tool_use["name"],
                            "input": tool_use["input"],
                        }
                    ],
                })
                working_history.append({
                    "role": "user",
                    "content": [
                        {
                            "type": "tool_result",
                            "tool_use_id": tool_use.get("id", f"tool_{step}"),
                            "content": json.dumps(
                                skill_result.data, ensure_ascii=False, default=str
                            ),
                        }
                    ],
                })
                continue  # 다음 스텝

            # 텍스트 응답 — 루프 종료
            break

        # MAX_STEPS 소진 후 텍스트가 없으면 강제 요약 호출
        if not response_text:
            rec.log_event("forced_summary", "MAX_STEPS reached, forcing final response")
            result = self.llm.chat(working_history, [], system)
            response_text = result.get("text", "") or "작업을 완료했습니다."

        # ── 최종 텍스트 스트리밍 ──────────────────────────────────────
        rec.set_final(response_text)

        for word in response_text.split():
            yield f"event: token\ndata: {json.dumps({'text': word + ' '})}\n\n"

        if conv_svc and response_text:
            conv_svc.append(
                user_id, scope, scope_id, "assistant", response_text,
                skill_call=(
                    {"name": last_tool_use["name"], "input": last_tool_use["input"]}
                    if last_tool_use else None
                ),
            )

        rec.log_event("done", f"response_len={len(response_text)}")
        rec.save()

        yield "event: done\ndata: {}\n\n"
```

- [ ] **Step 3.2: Verify the file is syntactically valid**

```bash
cd backend
python -c "from app.ai.chat_orchestrator import ChatOrchestrator, MAX_STEPS; print('MAX_STEPS =', MAX_STEPS)"
```
Expected: `MAX_STEPS = 10`

- [ ] **Step 3.3: Commit**

```bash
git add app/ai/chat_orchestrator.py
git commit -m "feat(ai): replace fixed 2-call orchestrator with ReAct loop (max 10 steps)"
```

---

## Task 4: Update PromptBuilder with Multi-Step Guidance

**Files:**
- Modify: `app/ai/prompt_builder.py` — add `### 복합 작업` section inside "행동 원칙"

- [ ] **Step 4.1: Add multi-step section to the prompt**

In `app/ai/prompt_builder.py`, find the line:

```python
### 삭제·포기
```

Insert the following block **before** it:

```python
### 복합 작업
여러 스킬이 필요한 작업은 스킬을 연속 호출하여 한 번의 응답에서 완료한다.
복잡하거나 단계가 많은 작업은 먼저 think 스킬로 실행 계획을 수립한 뒤 진행한다.
이전 스킬 결과(plant_id 등)를 즉시 다음 스킬 인수로 활용한다.
예시:
- "취업·건강 식물 만들고 각각 봉우리 추가" → think → create_plant(취업) → create_plant(건강) → create_bud(취업 plant_id, ...) → create_bud(건강 plant_id, ...)
- "정원 현황 분석 후 시들고 있는 봉우리 모두 처리" → get_garden_briefing → list_buds(wilting_only=true) → update_bud_status×N

```

- [ ] **Step 4.2: Verify prompt contains the new section**

```bash
cd backend
python -c "
from app.ai.prompt_builder import PromptBuilder
from app.ai.skill_base import SkillContext
from unittest.mock import MagicMock
ctx = MagicMock()
p = PromptBuilder().build_system(ctx, '웹', {}, [])
assert 'think' in p, 'think not in prompt'
assert '복합 작업' in p, '복합 작업 section missing'
print('OK')
"
```
Expected: `OK`

- [ ] **Step 4.3: Commit**

```bash
git add app/ai/prompt_builder.py
git commit -m "feat(ai): add multi-step + think skill guidance to system prompt"
```

---

## Task 5: Restart and Smoke Test

- [ ] **Step 5.1: Restart backend**

```bash
# Kill existing python run.py process, then:
cd backend
python run.py
```
Expected: server starts on port 8000, no import errors.

- [ ] **Step 5.2: Test single-step still works (regression)**

In the chat UI, send: `정원 현황 알려줘`

Expected: AI calls `get_garden_briefing` or `get_statistics` and responds with garden summary. No error.

- [ ] **Step 5.3: Test multi-step chain**

In the chat UI, send: `취업이랑 건강 식물 두 개 만들어줘`

Expected:
- Dashboard shows 2 new plants created
- Chat log (`backend/logs/chat/*.json`) shows `skill_1` and `skill_2` events, with 2 separate `create_plant` dispatches
- AI responds confirming both were created

- [ ] **Step 5.4: Test think + chain**

In the chat UI, send: `취업 식물 만들고 거기에 면접 준비 봉우리도 바로 추가해줘`

Expected:
- AI calls `think` → `create_plant` → `create_bud` in sequence
- Log shows `skill_1=think`, `skill_2=create_plant`, `skill_3=create_bud`
- Dashboard shows new plant with 1 bud

- [ ] **Step 5.5: Commit final**

```bash
git add -A
git commit -m "feat(ai): multi-step ReAct orchestrator — think skill + chain execution"
```
