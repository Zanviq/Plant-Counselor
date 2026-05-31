# GardenState JSON

> 경로: `data/users/<nickname>/garden.json`

관련 문서: [[통계_시스템]], [[홈]]

---

## 스키마

| 필드 | 타입 | 설명 |
|---|---|---|
| `last_opened_at` | string(ISO) | 마지막 진입 시각 |
| `summary_cache` | object | 홈 요약 카드용 캐시 |
| `summary_cache.active_concerns` | integer |  |
| `summary_cache.active_schedules` | integer |  |
| `summary_cache.harvested_this_month` | integer |  |
| `summary_cache.wilting_count` | integer |  |
| `summary_cache.rot_count` | integer |  |
| `summary_cache.plants_total` | integer |  |
| `summary_cache.plants_active` | integer |  |
| `summary_cache.computed_at` | string(ISO) | 캐시 계산 시각 |
| `daily_briefing` | object | 오늘의 정원 메시지 캐시 |
| `daily_briefing.date` | string(ISO date) |  |
| `daily_briefing.text` | string | 생성된 문장 |

---

## 예시

```
{
  "last_opened_at": "2026-05-18T07:30:00",
  "summary_cache": {
    "active_concerns": 4,
    "active_schedules": 3,
    "harvested_this_month": 6,
    "wilting_count": 1,
    "rot_count": 0,
    "plants_total": 5,
    "plants_active": 4,
    "computed_at": "2026-05-18T07:30:00"
  },
  "daily_briefing": {
    "date": "2026-05-18",
    "text": "오늘은 학업 식물의 봉우리 하나가 열매 단계에 있습니다."
  }
}
```

---

## 관련 클래스
- [[클래스_함수_사전#GardenStateManager]]
