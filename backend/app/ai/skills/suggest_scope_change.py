from __future__ import annotations
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class SuggestScopeChangeSkill(SkillBase):
    name = "suggest_scope_change"
    description = (
        "현재 plant 또는 bud 스코프와 다른 식물에 관한 요청이 처리됐을 때 호출합니다. "
        "사용자에게 대화 세션을 변경할지 제안하는 UI를 표시합니다. "
        "반드시 다른 스킬 실행을 모두 완료한 뒤 마지막으로 호출하세요. "
        "global 또는 calendar 스코프에서는 절대 호출하지 마세요."
    )
    parameters = {
        "type": "object",
        "properties": {
            "target_scope": {
                "type": "string",
                "enum": ["plant", "bud", "global"],
                "description": "변경을 제안할 대상 스코프 (보통 'plant')",
            },
            "target_id": {
                "type": "string",
                "description": "변경할 plant_id 또는 bud_id (알고 있으면 반드시 포함)",
            },
            "target_name": {
                "type": "string",
                "description": "변경할 식물 또는 봉우리의 이름 (UI에 표시됨, 필수)",
            },
        },
        "required": ["target_scope", "target_name"],
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        return SkillResult(
            ok=True,
            message="세션 변경 제안",
            data={
                "suggest_scope_change": True,
                "target_scope": args.get("target_scope", "plant"),
                "target_id": args.get("target_id"),
                "target_name": args.get("target_name", ""),
            },
        )
