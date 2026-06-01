# Skill: get_garden_briefing

> "오늘의 정원 메시지"의 재료 데이터를 가져온다.

관련 문서: [[Web/03_LLM/Skill_개요]], [[Web/01_페이지/홈#2-오늘의-정원-메시지]], [[Web/02_기능/알림]]

---

## 설명(LLM 용)

홈에 보여줄 한 문단 메시지를 만들기 위한 정보. 이 Skill 자체는 텍스트를 생성하지 않고 데이터만 돌려준다. 최종 문구는 LLM이 합성한다.

---

## 파라미터

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `as_of` | string(ISO date) | 선택 | 기본 오늘 |

---

## 반환

- `ok`: bool
- `data.stats`: [[get_statistics]] 결과 요약
- `data.notable_buds`: 다음 항목 배열 (각 5개 이내)
  - `flowering_soon` — fruit 직전인 봉우리들
  - `wilting` — 새로 시들기 시작한 봉우리들
  - `deadline_soon` — 임박 마감 봉우리들
- `data.idle_plants`: 휴면 식물 이름들

---

## 사전 검증

없음.

---

## 내부 동작

[[클래스_함수_사전#GardenStateManager]].`build_briefing(as_of)`. 내부적으로 [[list_buds]]과 동일한 [[BudManager]].`list`를 사용.

---

## 확인 필요 여부

아니오.

---

## 연결되는 함수
- [[클래스_함수_사전#GardenStateManager]].`build_briefing`
- [[클래스_함수_사전#BudManager]].`list`
