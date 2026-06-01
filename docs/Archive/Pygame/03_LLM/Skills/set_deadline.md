# Skill: set_deadline

> 봉우리의 마감일을 설정/변경/제거한다.

관련 문서: [[Web/03_LLM/Skill_개요]], [[Web/02_기능/캘린더]], [[Web/02_기능/알림]]

---

## 설명(LLM 용)

사용자가 "다음 주 금요일까지", "마감 없애줘" 등 마감일에 대해 말할 때 호출. 기존 마감일이 있는 경우 변경 전 사용자 확인 필요.

---

## 파라미터

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `bud_id` | string | 필수 | 대상 봉우리 |
| `deadline` | string(ISO date) or null | 필수 | null이면 제거 |

---

## 반환

- `ok`: bool
- `data.bud`
- `message`

---

## 사전 검증

- 봉우리 존재 여부.
- 날짜 형식 유효성.
- 과거 날짜인 경우 경고 메시지 포함(차단은 하지 않음).

---

## 내부 동작

[[클래스_함수_사전#BudManager]].`set_deadline(bud_id, deadline)` → [[Bud_JSON#deadline]] 갱신 → [[NotificationQueue]]에 마감 임박 항목 재계산.

---

## 확인 필요 여부

기존 마감일이 있으면 예. 없으면 아니오.

---

## 연결되는 함수
- [[클래스_함수_사전#BudManager]].`set_deadline`
- [[클래스_함수_사전#NotificationQueue]].`recompute_deadlines`
