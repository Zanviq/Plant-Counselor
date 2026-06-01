# Skill: match_plant

> 사용자의 발화에 가장 어울리는 기존 식물을 찾는다.

관련 문서: [[Web/03_LLM/Skill_개요]], [[create_plant]], [[Plant_JSON]]

---

## 설명(LLM 용)

사용자가 새 고민이나 일정을 말했을 때, 기존 식물 중 의미상 가장 가까운 식물이 있는지 후보를 받아온다. 후보가 없거나 부족하면 [[create_plant]]을 제안한다.

---

## 파라미터

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `query` | string | 필수 | 사용자의 발화에서 추출한 핵심 문구 |
| `hint_category` | string | 선택 | LLM이 추정한 분야명 후보 |
| `top_k` | integer | 선택 | 기본 3, 최대 5 |

---

## 반환

- `ok`: bool
- `data.candidates`: 다음 항목 배열
  - `plant_id`, `name`, `description`, `score`(0~1), `reason`
- `message`: 짧은 요약 텍스트

---

## 내부 동작

[[클래스_함수_사전#PlantManager]].`find_matches(query, hint_category, top_k)`를 호출. 매칭 방식은 단순 키워드 + 분야 설명 텍스트 매칭으로 시작하며, 후일 임베딩 기반으로 확장 가능.

---

## 확인 필요 여부

아니오. 조회 전용.

---

## 연결되는 함수
- [[클래스_함수_사전#PlantManager]].`find_matches`
