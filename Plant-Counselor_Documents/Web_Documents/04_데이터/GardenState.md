# GardenState 테이블

> 사용자 1명당 1행. 요약 캐시 + 오늘의 브리핑 캐시.

관련 문서: [[DB_스키마]], [[통계_시스템]], [[홈]]

---

## 컬럼

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `user_id` | string | PK (1:1) |
| `last_opened_at` | timestamptz | |
| `summary_cache` | JSON | `{ active_concerns, active_schedules, harvested_this_month, wilting_count, rot_count, plants_total, plants_active, computed_at }` |
| `daily_briefing` | JSON | `{ date, text }` |
| `updated_at` | timestamptz | |

---

## 캐시 무효화

다음 사건에서 `summary_cache.computed_at`을 갱신한다.

- 봉우리 생성/상태 전이/삭제
- 식물 생성/삭제
- [[백그라운드_작업]]의 `transition_scan` 종료 시
- `GET /stats/summary` 호출 시 만료(예: 5분 이상 경과) 확인

`daily_briefing`은 매일 사용자 타임존 06:00 무효화.

---

## 응답 예시

```
{
  "summary": {
    "active_concerns": 4,
    "active_schedules": 3,
    "harvested_this_month": 6,
    "wilting_count": 1,
    "rot_count": 0,
    "plants_total": 5,
    "plants_active": 4,
    "computed_at": "2026-05-18T07:30:00Z"
  },
  "briefing": {
    "date": "2026-05-18",
    "text": "오늘은 학업 식물의 봉우리 하나가 열매 단계에 있습니다."
  }
}
```
