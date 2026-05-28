"""Chat router — single endpoint that streams an SSE response."""
from __future__ import annotations
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from supabase import Client

from app.ai.chat_orchestrator import ChatOrchestrator
from app.ai.llm_client import LLMClient
from app.ai.prompt_builder import PromptBuilder
from app.ai.skill_registry import SkillRegistry
from app.ai.skills.abandon_bud import AbandonBudSkill
from app.ai.skills.create_bud import CreateBudSkill
from app.ai.skills.create_plant import CreatePlantSkill
from app.ai.skills.delete_plant import DeletePlantSkill
from app.ai.skills.get_garden_briefing import GetGardenBriefingSkill
from app.ai.skills.get_statistics import GetStatisticsSkill
from app.ai.skills.harvest_bud import HarvestBudSkill
from app.ai.skills.list_buds import ListBudsSkill
from app.ai.skills.list_plants import ListPlantsSkill
from app.ai.skills.match_plant import MatchPlantSkill
from app.ai.skills.search_conversation import SearchConversationSkill
from app.ai.skills.set_deadline import SetDeadlineSkill
from app.ai.skills.suggest_scope_change import SuggestScopeChangeSkill
from app.ai.skills.think import ThinkSkill
from app.ai.skills.update_bud_progress import UpdateBudProgressSkill
from app.ai.skills.update_bud_status import UpdateBudStatusSkill
from app.config import settings
from app.deps import get_db, require_user
from app.schemas.conversation import ChatRequest
from app.services.bud_service import BudService
from app.services.conversation_service import ConversationService
from app.services.garden_state_service import GardenStateService
from app.services.plant_service import PlantService
from app.services.user_service import UserService

router = APIRouter(tags=["chat"])


def _build_registry() -> SkillRegistry:
    reg = SkillRegistry()
    for skill_cls in (
        ThinkSkill, MatchPlantSkill, CreatePlantSkill, DeletePlantSkill,
        CreateBudSkill, UpdateBudStatusSkill, UpdateBudProgressSkill,
        SetDeadlineSkill, AbandonBudSkill, HarvestBudSkill,
        ListPlantsSkill, ListBudsSkill, GetStatisticsSkill,
        GetGardenBriefingSkill, SearchConversationSkill, SuggestScopeChangeSkill,
    ):
        reg.register(skill_cls())
    return reg


_REGISTRY = _build_registry()
_PROMPT_BUILDER = PromptBuilder()


def _resolve_api_key(db: Client, user) -> str:
    try:
        key = UserService(db).get_api_key(user.id)
    except Exception:
        key = None
    return key or settings.llm_api_key


@router.post("/chat/message")
def chat_message(req: ChatRequest, user=Depends(require_user), db: Client = Depends(get_db)):
    api_key = _resolve_api_key(db, user)
    llm = LLMClient(api_key)
    services = {
        "plant": PlantService(db),
        "bud": BudService(db),
        "garden_state": GardenStateService(db),
        "conversation": ConversationService(db),
    }
    orchestrator = ChatOrchestrator(llm, _REGISTRY, _PROMPT_BUILDER, services)

    def generate():
        yield from orchestrator.run(user.id, req.text, req.scope, req.scope_id, req.current_screen, db)

    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
