# garden_state 테이블

사용자별 정원 상태 행이다.

| 필드 | 의미 |
| --- | --- |
| `id` | ULID PK |
| `user_id` | 사용자 격리 키 |
| `summary_cache` | 최근 요약 통계 |

`GET /api/v1/stats/summary`는 식물과 봉우리를 다시 집계하고 `summary_cache`를
갱신한다. `GET /api/v1/briefing/today`도 현재 상태를 반영하도록 요청마다 브리핑을
다시 만든다.

현재 summary:

```text
active_concerns
active_schedules
harvested_this_month
wilting_count
rot_count
total_plants
```
