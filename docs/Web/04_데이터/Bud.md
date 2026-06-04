# buds 테이블

봉우리는 식물 아래의 고민, 목표, 추적 일정이다.

| 필드 | 의미 |
| --- | --- |
| `id` | ULID PK |
| `user_id` | 사용자 격리 키 |
| `plant_id` | 소속 식물 |
| `title`, `detail` | 제목과 설명 |
| `type` | `concern` 또는 `schedule` |
| `status` | `bud`, `flower`, `fruit`, `harvested`, `wilting`, `rot` |
| `progress` | 0~100 진행률 |
| `deadline` | 선택 마감일 |
| `last_progress_at` | 최근 상태 또는 진행률 갱신 |
| `disappeared_at` | 썩어 사라진 시각 |
| `created_at`, `updated_at` | 생성, 수정 시각 |

## bud_history

상태 변경은 append-only 이력으로 남긴다.

| 필드 | 의미 |
| --- | --- |
| `id` | ULID PK |
| `bud_id` | 대상 봉우리 |
| `from_status`, `to_status` | 이전, 다음 상태 |
| `at` | 전이 시각 |
| `reason` | 변경 이유 |

`backend/migrations/004_remove_seed_bud_status.sql`은 과거 `seed` 행을 `bud`로 승격하고
DB 기본값도 `bud`로 바꾼다.

봉우리는 `PATCH /api/v1/buds/{bud_id}/move`로 다른 식물로 이동할 수 있다. 이동은
`plant_id`를 직접 열어두는 일반 patch가 아니라 `BudService.move_to_plant()`를 통해
대상 식물이 같은 사용자 소유인지, archived 상태가 아닌지 확인한 뒤 처리한다.
