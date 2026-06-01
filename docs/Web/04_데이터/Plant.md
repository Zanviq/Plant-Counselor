# plants 테이블

식물은 사용자의 관리 분야 또는 카테고리다.

| 필드 | 의미 |
| --- | --- |
| `id` | ULID PK |
| `user_id` | `profiles.id` 사용자 격리 키 |
| `name` | 분야명 |
| `description` | 설명 |
| `species` | 외형 키 |
| `color` | 색상 키 |
| `status` | `active`, `dormant`, `archived` |
| `harvested_count` | 누적 수확 |
| `rot_count` | 누적 썩음 |
| `active_bud_count` | 활성 봉우리 수 |
| `last_activity_at` | 최근 활동 |
| `created_at`, `updated_at` | 생성, 수정 시각 |

일반 목록은 archived 식물을 제외한다. 삭제 기본 동작은 `status="archived"`로 바꾸는
archive이며, 명시적 hard delete도 지원한다.
