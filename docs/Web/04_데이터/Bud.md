# Bud 테이블

관련 문서: [[DB_스키마]], [[Plant]], [[Web/02_기능/봉우리_생애주기]]

---

## 컬럼

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | string | PK |
| `user_id` | string | FK |
| `plant_id` | string | FK |
| `title` | string | 1~60자 |
| `detail` | text | nullable |
| `type` | enum | `concern` / `schedule` |
| `status` | enum | `seed` / `bud` / `flower` / `fruit` / `harvested` / `wilting` / `rot` |
| `progress` | int | 0~100 |
| `deadline` | date | nullable |
| `last_progress_at` | timestamptz | |
| `disappeared_at` | timestamptz | rot 만료 시각, UI에서 숨김 |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

## `bud_history` (별도 테이블)

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | string | PK |
| `bud_id` | string | FK |
| `from_status` | enum | |
| `to_status` | enum | |
| `at` | timestamptz | |
| `reason` | string | `auto:...` / `user:...` |

`bud_history`는 봉우리당 append-only.

---

## 인덱스

- `(user_id, status)`
- `(user_id, deadline)` (마감 임박 검색용)
- `(plant_id, status)`
- `(user_id, last_progress_at)` (시듦 검사용)

---

## 응답 예시 (`GET /buds/{id}`)

```
{
  "id": "01HZX-BD-07",
  "plant_id": "01HZX-PL-01",
  "title": "기말 프로젝트 마무리",
  "detail": "데이터 시각화 과제 보고서까지 포함",
  "type": "schedule",
  "status": "fruit",
  "progress": 80,
  "deadline": "2026-05-25",
  "last_progress_at": "2026-05-17T18:42:11Z",
  "history": [
    {"from": "seed", "to": "bud",    "at": "...", "reason": "auto:initial"},
    {"from": "bud",  "to": "flower", "at": "...", "reason": "user:본격적으로 시작"},
    {"from": "flower","to": "fruit",  "at": "...", "reason": "auto:progress>=75"}
  ]
}
```
