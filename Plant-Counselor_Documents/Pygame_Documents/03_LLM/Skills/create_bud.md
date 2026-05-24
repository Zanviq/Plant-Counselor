# Skill: create_bud

> 식물에 새 봉우리(고민/일정)를 매단다.

관련 문서: [[Skill_개요]], [[봉우리_생애주기]], [[Bud_JSON]]

---

## 설명(LLM 용)

[[Skills/match_plant]]에서 적절한 식물을 찾은 직후, 사용자가 동의하면 호출한다. 새 식물을 만든 직후에도 곧장 호출되어 첫 봉우리를 매단다.

---

## 파라미터

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `plant_id` | string | 필수 | 매달 식물 |
| `title` | string | 필수 | 봉우리 제목(짧게) |
| `detail` | string | 선택 | 부가 설명 |
| `type` | enum(`concern`,`schedule`) | 필수 | 고민/일정 구분 |
| `deadline` | string(ISO date) | 선택 | 마감일 |
| `initial_status` | enum | 선택 | 기본 `seed`. 즉시 `bud` 가능 |

---

## 반환

- `ok`: bool
- `data.bud_id`
- `data.bud`: 전체 [[Bud_JSON]] 객체

---

## 사전 검증

- 식물 존재 여부.
- 제목 1~60자.
- 동일 식물에 거의 동일한 제목의 활성 봉우리가 있는지 검사(중복 경고).

---

## 내부 동작

[[클래스_함수_사전#BudManager]].`create(...)` → [[Bud_JSON]] 파일 생성 → [[GardenStateManager]] 캐시 갱신.

---

## 확인 필요 여부

아니오(단, LLM은 보통 새 식물 생성 직후에만 즉시 호출).

---

## 연결되는 함수
- [[클래스_함수_사전#BudManager]].`create`
- [[클래스_함수_사전#GardenStateManager]].`refresh_summary`
