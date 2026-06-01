# Skill: list_plants

> 사용자의 모든 식물 목록을 가져온다.

관련 문서: [[Web/03_LLM/Skill_개요]], [[Plant_JSON]]

---

## 설명(LLM 용)

회고/탐색/매칭 보조용. 매칭이 목적이라면 [[match_plant]]를 우선 고려.

---

## 파라미터

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `include_dormant` | bool | 선택 | 기본 true |
| `sort` | enum(`activity`,`created`,`name`) | 선택 | 기본 `activity` |

---

## 반환

- `ok`: bool
- `data.plants`: 식물 객체 배열(요약 필드 위주: id, name, description, active_bud_count, harvested_count, status)

---

## 사전 검증

없음.

---

## 내부 동작

[[클래스_함수_사전#PlantManager]].`list(include_dormant, sort)`.

---

## 확인 필요 여부

아니오.

---

## 연결되는 함수
- [[클래스_함수_사전#PlantManager]].`list`
