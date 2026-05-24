from __future__ import annotations
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class CreatePlantSkill(SkillBase):
    name = "create_plant"
    description = (
        "새 식물(분야/카테고리)을 생성합니다. "
        "사용자가 새 분야를 시작한다고 확인했을 때 호출하세요. "
        "반드시 match_plant로 중복 여부를 먼저 확인하세요."
    )
    parameters = {
        "type": "object",
        "properties": {
            "name": {"type": "string", "description": "식물 이름 (분야명)"},
            "description": {"type": "string", "description": "식물 설명"},
            "species": {"type": "string", "description": "식물 종류 (기본값: tree_oak)"},
            "color": {"type": "string", "description": "색상 (기본값: brand.primary_leaf)"},
        },
        "required": ["name", "description"],
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        plant = ctx.plant_service.create(
            ctx.user_id,
            args["name"],
            args.get("description", ""),
            args.get("species", "tree_oak"),
            args.get("color", "brand.primary_leaf"),
        )
        return SkillResult(
            ok=True,
            message=f"'{plant.name}' 식물을 만들었습니다.",
            data={"plant_id": plant.id, "name": plant.name},
        )
