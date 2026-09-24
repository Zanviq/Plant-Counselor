"""Chat router — single endpoint that streams an SSE response."""
from __future__ import annotations
import json
from fastapi import APIRouter, Depends, Header
from fastapi.responses import StreamingResponse
from app.db.pg import Client

from app.ai.chat_orchestrator import ChatOrchestrator
from app.ai.llm_client import LLMClient
from app.ai.prompt_builder import PromptBuilder
from app.ai.skill_registry import SkillRegistry
from app.ai.skill_base import SkillContext
from app.ai.skills.abandon_bud import AbandonBudSkill
from app.ai.skills.create_bud import CreateBudSkill
from app.ai.skills.create_calendar_event import CreateCalendarEventSkill
from app.ai.skills.create_plant import CreatePlantSkill
from app.ai.skills.delete_calendar_event import DeleteCalendarEventSkill
from app.ai.skills.delete_plant import DeletePlantSkill
from app.ai.skills.get_garden_briefing import GetGardenBriefingSkill
from app.ai.skills.get_statistics import GetStatisticsSkill
from app.ai.skills.harvest_bud import HarvestBudSkill
from app.ai.skills.list_buds import ListBudsSkill
from app.ai.skills.list_calendar_events import ListCalendarEventsSkill
from app.ai.skills.list_plants import ListPlantsSkill
from app.ai.skills.update_calendar_event import UpdateCalendarEventSkill
from app.ai.skills.match_plant import MatchPlantSkill
from app.ai.skills.search_conversation import SearchConversationSkill
from app.ai.skills.set_deadline import SetDeadlineSkill
from app.ai.skills.suggest_scope_change import SuggestScopeChangeSkill
from app.ai.skills.think import ThinkSkill
from app.ai.skills.update_bud_progress import UpdateBudProgressSkill
from app.ai.skills.update_bud_status import UpdateBudStatusSkill
from app.deps import get_db, require_user
from app.schemas.conversation import ChatRequest
from app.services.bud_service import BudService
from app.services.calendar_service import CalendarService
from app.services.conversation_service import ConversationService
from app.services.garden_state_service import GardenStateService
from app.services.plant_service import PlantService

router = APIRouter(tags=["chat"])


def _build_registry() -> SkillRegistry:
    reg = SkillRegistry()
    for skill_cls in (
        ThinkSkill, MatchPlantSkill, CreatePlantSkill, DeletePlantSkill,
        CreateBudSkill, UpdateBudStatusSkill, UpdateBudProgressSkill,
        SetDeadlineSkill, AbandonBudSkill, HarvestBudSkill,
        ListPlantsSkill, ListBudsSkill, GetStatisticsSkill,
        GetGardenBriefingSkill, SearchConversationSkill, SuggestScopeChangeSkill,
        CreateCalendarEventSkill, ListCalendarEventsSkill,
        UpdateCalendarEventSkill, DeleteCalendarEventSkill,
    ):
        reg.register(skill_cls())
    return reg


_REGISTRY = _build_registry()
_PROMPT_BUILDER = PromptBuilder()


# The Gemini API key is supplied by the browser on every request (the user
# pastes their own key in Settings; it lives only in localStorage). The server
# uses it for this request only and never stores or logs it.
API_KEY_HEADER = "X-Gemini-Api-Key"


def _api_key_missing_stream():
    payload = json.dumps({
        "code": "api_key_required",
        "message": "Gemini API 키가 필요합니다. 설정 → AI에서 본인 키를 입력해 주세요.",
    }, ensure_ascii=False)
    yield "event: start\ndata: {\"message_id\":\"no_key\"}\n\n"
    yield f"event: error\ndata: {payload}\n\n"
    yield "event: done\ndata: {}\n\n"


def _build_services(db: Client) -> dict:
    return {
        "plant": PlantService(db),
        "bud": BudService(db),
        "garden_state": GardenStateService(db),
        "conversation": ConversationService(db),
        "calendar": CalendarService(db),
    }


def _build_skill_context(user, db: Client, req: ChatRequest) -> SkillContext:
    services = _build_services(db)
    return SkillContext(
        user_id=user.id,
        db=db,
        plant_service=services["plant"],
        bud_service=services["bud"],
        garden_state_service=services["garden_state"],
        conversation_service=services["conversation"],
        calendar_service=services["calendar"],
        scope=req.scope,
        scope_id=req.scope_id,
    )


@router.post("/chat/message")
def chat_message(
    req: ChatRequest,
    user=Depends(require_user),
    db: Client = Depends(get_db),
    gemini_api_key: str | None = Header(None, alias=API_KEY_HEADER),
):
    if req.confirmed_actions:
        ctx = _build_skill_context(user, db, req)

        def confirmed_generate():
            yield "event: start\ndata: {\"message_id\":\"confirmed_1\"}\n\n"
            messages: list[str] = []
            for action in req.confirmed_actions or []:
                name = str(action.get("name", ""))
                args = action.get("args") if isinstance(action.get("args"), dict) else {}
                yield f"event: tool_call\ndata: {json.dumps({'name': name, 'args': args}, ensure_ascii=False, default=str)}\n\n"
                result = _REGISTRY.dispatch(name, args, ctx)
                yield (
                    "event: tool_result\ndata: "
                    f"{json.dumps({'name': name, 'result': {'ok': result.ok, 'message': result.message, 'data': result.data}}, ensure_ascii=False, default=str)}\n\n"
                )
                messages.append(result.message)
            final = "실행했습니다." if not messages else "\n".join(messages)
            for word in final.split():
                yield f"event: token\ndata: {json.dumps({'text': word + ' '}, ensure_ascii=False)}\n\n"
            yield "event: done\ndata: {}\n\n"

        return StreamingResponse(confirmed_generate(), media_type="text/event-stream",
                                 headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

    import app.runtime_settings as rs
    api_key = (gemini_api_key or "").strip()
    if not api_key:
        return StreamingResponse(_api_key_missing_stream(), media_type="text/event-stream",
                                 headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
    # Priority: per-user override → runtime default → LLMClient.DEFAULT_MODEL.
    user_model = getattr(user, "ai_model", None)
    global_model = rs.get("llm_default_model", LLMClient.DEFAULT_MODEL)
    model = user_model or global_model
    llm = LLMClient(api_key, model=model)
    services = _build_services(db)
    orchestrator = ChatOrchestrator(llm, _REGISTRY, _PROMPT_BUILDER, services)
    user_tone = getattr(user, "tone", None) or "counselor"

    def generate():
        yield from orchestrator.run(
            user.id, req.text, req.scope, req.scope_id, req.current_screen, db,
            tone=user_tone,
            require_confirmation=req.require_confirmation,
        )

    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
