from __future__ import annotations
import json

from app.ai.log_recorder import LogRecorder
from app.ai.skill_base import SkillContext
import app.runtime_settings as rs

MAX_STEPS = 10  # fallback; actual value read from runtime_settings each run


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
        cal_svc = self.services.get("calendar")

        ctx = SkillContext(
            user_id=user_id,
            db=db,
            plant_service=plant_svc,
            bud_service=bud_svc,
            garden_state_service=gs_svc,
            conversation_service=conv_svc,
            calendar_service=cal_svc,
            scope=scope,
            scope_id=scope_id,
        )

        stats = gs_svc.get_summary(user_id) if gs_svc else {}
        plants = plant_svc.list(user_id) if plant_svc else []

        # Resolve plant name for scope context (plant scope only)
        scope_plant_name = ""
        if scope == "plant" and scope_id and plants:
            matching = [p for p in plants if p.id == scope_id]
            if matching:
                scope_plant_name = matching[0].name

        system = self.builder.build_system(
            ctx, current_screen, stats, plants,
            scope=scope, scope_id=scope_id, scope_plant_name=scope_plant_name,
        )
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
        _max_steps = rs.get("llm_max_steps", MAX_STEPS)
        for step in range(_max_steps):
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

                # 스킬 교환을 working_history에 추가 → 다음 스텝에서 LLM이 결과를 볼 수 있음
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

        # MAX_STEPS 소진 후에도 텍스트가 없으면 강제 요약 호출
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
