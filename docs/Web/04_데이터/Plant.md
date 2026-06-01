# Plant 테이블

관련 문서: [[DB_스키마]], [[Bud]], [[Web/01_페이지/식물]]

---

## 컬럼

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | string | PK |
| `user_id` | string | FK → users.id |
| `name` | string | 분야명 (1~24자) |
| `description` | string | 한 줄 설명 |
| `species` | string | 외형 키 (`tree_oak` 등) |
| `color` | string | 컬러 팔레트 토큰 키 |
| `status` | enum | `active` / `dormant` / `archived` |
| `harvested_count` | int | 누적 수확 |
| `rot_count` | int | 누적 썩음 |
| `active_bud_count` | int | 캐시값, 실시간 갱신 |
| `last_activity_at` | timestamptz | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

## 인덱스

- `(user_id, status)`
- `(user_id, last_activity_at DESC)`
- `(user_id, name)` (사용자 안에서 동일 이름 활성 식물 1개 가드)

---

## 응답 예시

```
{
  "id": "01HZX-PL-01",
  "name": "학업",
  "description": "공부와 학교 관련 모든 일",
  "species": "tree_oak",
  "color": "brand.primary_leaf",
  "status": "active",
  "stats": {
    "harvested_count": 5,
    "rot_count": 1,
    "active_bud_count": 3
  },
  "last_activity_at": "2026-05-17T18:42:11Z",
  "created_at": "2026-04-01T10:00:00Z"
}
```
