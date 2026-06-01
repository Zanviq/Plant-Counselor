# Skill: update_bud_progress

> 봉우리의 진행률(0~100)을 갱신한다. 필요한 경우 상태도 함께 전이될 수 있다.

관련 문서: [[Web/03_LLM/Skill_개요]], [[Web/02_기능/봉우리_생애주기]]

---

## 설명(LLM 용)

사용자가 진행 상황을 알릴 때 호출. 진행률만 바꾸거나, 임계 이상이면 상태도 자동으로 전이(bud→flower, flower→fruit)할 수 있다.

---

## 파라미터

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `bud_id` | string | 필수 | 대상 봉우리 |
| `progress` | integer | 필수 | 0~100 |
| `auto_transition` | bool | 선택 | 기본 true. 임계 도달 시 상태 자동 전이 |
| `note` | string | 선택 | LLM이 남길 짧은 메모 |

---

## 반환

- `ok`: bool
- `data.bud`: 변경 후 [[Bud_JSON]] 객체
- `data.transitioned`: bool (상태 전이가 발생했는지)
- `message`

---

## 사전 검증

- 진행률 범위.
- 봉우리 상태가 `harvested` 또는 `rot`이면 실패(완료/포기된 항목은 진행률 변경 불가).

---

## 내부 동작

[[클래스_함수_사전#BudManager]].`update_progress(bud_id, progress, auto_transition, note)` → 임계 도달 시 내부에서 `update_status`도 함께 호출 → 이력 추가.

---

## 확인 필요 여부

아니오.

---

## 연결되는 함수
- [[클래스_함수_사전#BudManager]].`update_progress`
- [[클래스_함수_사전#BudManager]].`update_status`
