# Skill: create_plant

> 새 식물(분야)을 정원에 심는다.

관련 문서: [[Skill_개요]], [[식물_생성]], [[Plant_JSON]], [[Skills/match_plant]]

---

## 설명(LLM 용)

[[Skills/match_plant]]에서 적절한 후보가 없거나 사용자가 명시적으로 새 분야를 원할 때 호출. 호출 전에 반드시 사용자 동의를 받는다.

---

## 파라미터

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `name` | string | 필수 | 분야명(예: 학업, 돈, 연애) |
| `description` | string | 필수 | 한 줄 설명 |
| `species` | string | 선택 | 외형 카테고리. 미지정 시 기본값 |
| `color` | string | 선택 | 색감 키. 미지정 시 species 기본 팔레트 |

---

## 반환

- `ok`: bool
- `data.plant_id`: 생성된 식물 id
- `data.plant`: 전체 [[Plant_JSON]] 객체
- `message`: 사용자에게 보일 짧은 안내

---

## 사전 검증

- 이름이 비어 있지 않고 1~24자.
- 동일 이름의 활성 식물 존재 여부 — 있으면 [[Skills/match_plant]]로 안내 후 실패.

---

## 내부 동작

[[클래스_함수_사전#PlantManager]].`create(name, description, species, color)` 호출 → [[폴더_구조]]에 식물 폴더와 메타 파일 생성 → [[GardenStateManager]]의 캐시 갱신.

---

## 확인 필요 여부

예. LLM은 호출 전 사용자에게 "이 분야를 새로운 식물로 심을까요?"를 묻는다.

---

## 연결되는 함수
- [[클래스_함수_사전#PlantManager]].`create`
- [[클래스_함수_사전#GardenStateManager]].`refresh_summary`
