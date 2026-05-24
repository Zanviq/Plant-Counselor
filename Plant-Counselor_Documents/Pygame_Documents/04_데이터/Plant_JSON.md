# Plant JSON

> 경로: `data/users/<nickname>/plants/<plant_id>/plant.json`

관련 문서: [[폴더_구조]], [[식물]], [[Bud_JSON]]

---

## 스키마

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string | 식물 id |
| `name` | string | 분야명 |
| `description` | string | 한 줄 설명 |
| `species` | string | 외형 카테고리 키 (예: `tree_oak`, `vine_morning_glory`) |
| `color` | string | 팔레트 키 |
| `created_at` | string(ISO) |  |
| `status` | enum | `active`/`dormant`/`archived` |
| `stats` | object | 누적 통계 |
| `stats.harvested_count` | integer | 누적 수확 수 |
| `stats.rot_count` | integer | 누적 썩음 수 |
| `stats.active_bud_count` | integer | 캐시값, 실시간 갱신 |
| `last_activity_at` | string(ISO) | 마지막 진행/생성 시각 |

---

## 예시

```
{
  "id": "01HZX-PL-01",
  "name": "학업",
  "description": "공부와 학교 관련 모든 일",
  "species": "tree_oak",
  "color": "leaf_green",
  "created_at": "2026-04-01T10:00:00",
  "status": "active",
  "stats": {
    "harvested_count": 5,
    "rot_count": 1,
    "active_bud_count": 3
  },
  "last_activity_at": "2026-05-17T18:42:11"
}
```

---

## 관련 클래스
- [[클래스_함수_사전#PlantManager]]
