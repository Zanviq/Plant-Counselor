# Skill: update_bud_status

> 봉우리의 상태를 다른 상태로 전이시킨다.

관련 문서: [[Web/03_LLM/Skill_개요]], [[Web/02_기능/봉우리_생애주기]], [[Web/02_기능/상태_자동전이]]

---

## 설명(LLM 용)

사용자가 진행 단계를 알리거나 시들었다가 다시 시작한다고 말할 때 호출. 완료/포기는 별도 Skill([[harvest_bud]], [[abandon_bud]])이 더 명확하다.

---

## 파라미터

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `bud_id` | string | 필수 | 대상 봉우리 |
| `to_status` | enum(`seed`,`bud`,`flower`,`fruit`,`wilting`) | 필수 | 전이 대상 상태 |
| `reason` | string | 선택 | LLM이 기록할 짧은 사유 |

---

## 반환

- `ok`: bool
- `data.bud`: 변경 후 [[Bud_JSON]] 객체
- `message`: "꽃으로 자랐어요" 같은 짧은 안내

---

## 사전 검증

- 봉우리 존재 여부.
- 전이 적법성: 정상 흐름 외의 전이는 [[Web/02_기능/봉우리_생애주기#분기-흐름]] 규칙을 따른다. 위반 시 실패.

---

## 내부 동작

[[클래스_함수_사전#BudManager]].`update_status(bud_id, to_status, reason)` → [[Bud_JSON#history]]에 이력 추가 → [[GardenStateManager]] 캐시 갱신.

---

## 확인 필요 여부

아니오.

---

## 연결되는 함수
- [[클래스_함수_사전#BudManager]].`update_status`
- [[클래스_함수_사전#GardenStateManager]].`refresh_summary`
