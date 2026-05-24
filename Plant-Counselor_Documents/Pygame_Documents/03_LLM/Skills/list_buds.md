# Skill: list_buds

> 봉우리 목록을 필터링해 가져온다.

관련 문서: [[Skill_개요]], [[Bud_JSON]]

---

## 설명(LLM 용)

"가장 오래 정체된 봉우리는?", "이번 주 마감 봉우리 보여줘" 등에서 호출.

---

## 파라미터

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `plant_id` | string | 선택 | 특정 식물의 봉우리만 |
| `statuses` | array<enum> | 선택 | 상태 필터 |
| `type` | enum(`concern`,`schedule`) | 선택 | 타입 필터 |
| `deadline_within_days` | integer | 선택 | N일 안에 마감 |
| `wilting_only` | bool | 선택 | wilting만 |
| `sort` | enum(`last_progress_asc`,`deadline_asc`,`created_desc`) | 선택 | 기본 `last_progress_asc` |
| `limit` | integer | 선택 | 기본 20 |

---

## 반환

- `ok`: bool
- `data.buds`: 봉우리 요약 객체 배열

---

## 사전 검증

- 파라미터 조합 충돌은 무시(우선순위 규칙은 [[클래스_함수_사전#BudManager]].`list` 참고).

---

## 내부 동작

[[클래스_함수_사전#BudManager]].`list(filters)`.

---

## 확인 필요 여부

아니오.

---

## 연결되는 함수
- [[클래스_함수_사전#BudManager]].`list`
