# Skill: delete_plant

> 식물을 삭제(아카이브)한다.

관련 문서: [[Skill_개요]], [[식물_생성#식물-삭제]], [[Plant_JSON]]

---

## 설명(LLM 용)

사용자가 명시적으로 분야를 정원에서 치우고 싶다고 말했을 때만 호출. 매달린 활성 봉우리가 있다면 한 번 더 확인.

---

## 파라미터

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `plant_id` | string | 필수 | 대상 식물 id |
| `archive` | bool | 선택 | 기본 true. false면 영구 삭제(권장하지 않음) |

---

## 반환

- `ok`: bool
- `data.archived_path`: 아카이브된 위치(또는 null)
- `message`: 짧은 안내

---

## 사전 검증

- 식물 존재 여부.
- 활성 봉우리 수 — 0이 아니면 LLM에 경고 메시지를 돌려주고 사용자 재확인을 요구.

---

## 내부 동작

[[클래스_함수_사전#PlantManager]].`delete(plant_id, archive)` → archive=true면 [[폴더_구조]]의 `archive/`로 이동, false면 폴더 삭제 → [[GardenStateManager]] 캐시 갱신.

---

## 확인 필요 여부

예. 두 단계 확인(활성 봉우리가 있으면).

---

## 연결되는 함수
- [[클래스_함수_사전#PlantManager]].`delete`
- [[클래스_함수_사전#GardenStateManager]].`refresh_summary`
