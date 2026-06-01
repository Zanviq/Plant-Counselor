# Skill: get_statistics

> 정원 통계를 가져온다.

관련 문서: [[Web/03_LLM/Skill_개요]], [[Web/02_기능/통계_시스템]], [[GardenState_JSON]]

---

## 설명(LLM 용)

상단 요약 카드 값, 회고용 수치, 분야별 분포 등.

---

## 파라미터

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `scope` | enum(`global`,`plant`) | 선택 | 기본 `global` |
| `plant_id` | string | 선택 | scope=`plant`일 때 |
| `period` | enum(`this_week`,`this_month`,`all_time`) | 선택 | 기본 `this_month` |

---

## 반환

- `ok`: bool
- `data.period`: 어떤 기간이 적용됐는지(`this_week` / `this_month` / `all_time`)
- `data.stats`: 다음 필드 포함
  - `active_concerns`, `active_schedules`, `harvested_count`(주어진 `period`에 대한 수확 수), `wilting_count`, `rot_count`, `plants_total`, `plants_active`

> 캐시([[GardenState_JSON#summary_cache]])는 항상 `this_month` 기준이라 그쪽 필드 이름은 `harvested_this_month`이다. 이 Skill의 `harvested_count`는 `period` 인자에 따라 의미가 달라지는 동일 개념.

---

## 사전 검증

- `scope=plant`인데 `plant_id` 누락 시 실패.

---

## 내부 동작

[[클래스_함수_사전#GardenStateManager]].`compute_stats(scope, plant_id, period)`.

---

## 확인 필요 여부

아니오.

---

## 연결되는 함수
- [[클래스_함수_사전#GardenStateManager]].`compute_stats`
