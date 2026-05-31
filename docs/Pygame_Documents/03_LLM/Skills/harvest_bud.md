# Skill: harvest_bud

> 봉우리를 수확(완료) 상태로 만든다.

관련 문서: [[Skill_개요]], [[봉우리_생애주기]], [[통계_시스템]]

---

## 설명(LLM 용)

사용자가 "끝났어", "해결됐어", "다 했어" 등 완료를 알릴 때 호출.

---

## 파라미터

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `bud_id` | string | 필수 | 대상 봉우리 |
| `note` | string | 선택 | 회고 메모 |

---

## 반환

- `ok`: bool
- `data.bud`
- `message`: 축하 한 줄

---

## 사전 검증

- 봉우리가 `harvested` 또는 `rot`이면 실패.

---

## 내부 동작

[[클래스_함수_사전#BudManager]].`harvest(bud_id, note)` → 상태 `harvested`, progress=100 → 식물 `harvested_count` 증가 → [[GardenStateManager]] 캐시 갱신 → 이번 달 수확 통계에 즉시 반영.

---

## 확인 필요 여부

아니오. 다만 LLM은 대상 봉우리가 명확하지 않으면 먼저 확인 질문을 한다.

---

## 연결되는 함수
- [[클래스_함수_사전#BudManager]].`harvest`
- [[클래스_함수_사전#PlantManager]].`increment_harvest`
- [[클래스_함수_사전#GardenStateManager]].`refresh_summary`
