# Skill 개요

> LLM이 백엔드 데이터를 안전하게 조회/조작하기 위해 호출하는 도구 집합.

관련 문서: [[LLM_흐름]], [[시스템_프롬프트]], [[AI_연동]], [[도메인_서비스]]

---

## Skill의 구성 요소

각 Skill은 다음을 가진다.

- **이름** (snake_case)
- **설명** (LLM 결정 보조용 자연어 — Gemini function description으로 전달)
- **파라미터** (JSON Schema → Gemini function parameters로 변환)
- **반환** (`ok: bool`, `message: str`, `data: dict`, 실패 시 `error_code: str`)
- **연결되는 서비스 메서드** ([[도메인_서비스]])

`requires_confirmation` 필드는 **존재하지 않는다**. 동의 확인은 LLM이 대화 흐름 안에서 처리한다.

---

## 등록된 Skill 목록 (14개)

| Skill | 설명 |
|---|---|
| `match_plant` | 기존 식물 중 유사한 것 검색. 새 식물 생성 전 먼저 호출. |
| `create_plant` | 새 식물(분야) 생성 |
| `delete_plant` | 식물과 하위 봉우리 삭제 |
| `create_bud` | 봉우리(고민/일정) 생성 |
| `update_bud_status` | 봉우리 상태 변경 (씨앗→꽃 등) |
| `update_bud_progress` | 봉우리 진행률(%) 업데이트 |
| `set_deadline` | 마감일 설정 |
| `abandon_bud` | 봉우리 포기 (썩음 상태) |
| `harvest_bud` | 봉우리 수확 완료 처리 |
| `list_plants` | 식물 목록 조회 |
| `list_buds` | 봉우리 목록 조회 |
| `get_statistics` | 정원 통계 조회 |
| `get_garden_briefing` | 오늘의 정원 브리핑 |
| `search_conversation` | 대화 이력 검색 |

---

## 카탈로그 제공 방식

- `SkillRegistry.build_catalog()` → Gemini function 스키마 배열.
- `LLMClient._to_gemini_tools(tools)` → Gemini API `Tool` 형식으로 변환.
- 매 LLM 호출 시 `tools` 파라미터로 전달.

---

## 등록

- `app/ai/skills/__init__.py`에서 모든 Skill 클래스를 import, `register(skill)`로 등록.

---

## 권한 가드

- Skill 인자에 들어온 `plant_id`/`bud_id`가 `ctx.user_id` 소유인지 검사 후 dispatch.
- 위반 시 `error_code="forbidden"` 반환.

---

## 에러 코드

- `invalid_argument`, `not_found`, `forbidden`, `conflict`, `internal`

---

## Skill 베이스 클래스

```python
class SkillBase(ABC):
    name: str = ""
    description: str = ""
    parameters: dict = {}        # JSON Schema

    @abstractmethod
    def run(self, args: dict, ctx: SkillContext) -> SkillResult: ...

    def to_tool_spec(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.parameters,
        }
```

`SkillContext`는 `user_id`, `db`, `plant_service`, `bud_service`, `garden_state_service`, `conversation_service`를 가진다.
