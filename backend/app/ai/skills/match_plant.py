from __future__ import annotations
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class MatchPlantSkill(SkillBase):
    name = "match_plant"
    description = (
        "기존 식물(분야) 중에서 쿼리와 가장 유사한 것을 검색합니다. "
        "새 고민/일정/식물 생성 전에 먼저 호출하여 중복을 방지하세요. "
        "매칭 결과가 없으면 create_plant로 새 식물을 만드세요."
    )
    parameters = {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "매칭할 내용"},
        },
        "required": ["query"],
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        matches = ctx.plant_service.find_matches(ctx.user_id, args.get("query", ""))
        data = [
            {"id": p.id, "name": p.name, "description": p.description}
            for p in matches
        ]
        return SkillResult(
            ok=True,
            message=f"{len(data)}개 식물 매칭",
            data={"matches": data},
        )

