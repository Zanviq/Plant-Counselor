# Skill: abandon_bud

> 봉우리를 포기(썩음) 상태로 만든다.

관련 문서: [[Skill_개요]], [[봉우리_생애주기]]

---

## 설명(LLM 용)

사용자가 명시적으로 "그만할래", "포기할래"라고 말할 때만 호출. 호출 전 짧은 회고 질문 한 번을 권장.

---

## 파라미터

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `bud_id` | string | 필수 | 대상 봉우리 |
| `reason` | string | 선택 | 사용자 회고 발화에서 추출한 짧은 이유 |

---

## 반환

- `ok`: bool
- `data.bud`
- `message`: 가벼운 위로 한 줄

---

## 사전 검증

- 봉우리가 이미 `harvested` 또는 `rot`이면 실패.

---

## 내부 동작

[[클래스_함수_사전#BudManager]].`abandon(bud_id, reason)` → 상태 `rot`로 전이, 이력 기록 → 식물 stats의 `rot_count` 증가 → [[GardenStateManager]] 캐시 갱신. 일정 일수 후 사라짐 처리는 [[상태_자동전이]]가 담당.

---

## 확인 필요 여부

예.

---

## 연결되는 함수
- [[클래스_함수_사전#BudManager]].`abandon`
- [[클래스_함수_사전#PlantManager]].`increment_rot`
- [[클래스_함수_사전#GardenStateManager]].`refresh_summary`
