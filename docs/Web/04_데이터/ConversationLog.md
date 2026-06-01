# 대화 기록

대화 스코프와 메시지를 정규화해 저장한다.

## conversations

| 필드 | 의미 |
| --- | --- |
| `id` | ULID PK |
| `user_id` | 사용자 격리 키 |
| `scope` | `global`, `plant`, `bud`, `calendar` |
| `scope_id` | 식물 또는 봉우리 ID. global과 calendar는 null 가능 |
| `created_at`, `updated_at` | 생성, 최근 갱신 |

## conversation_messages

| 필드 | 의미 |
| --- | --- |
| `id` | ULID PK |
| `conversation_id` | 소속 세션 |
| `role` | 메시지 역할 |
| `text` | 메시지 본문 |
| `skill_call` | 스킬 호출 메타데이터 |
| `at` | 시각 |

`GET /api/v1/conversations/list`가 기록 브라우저의 트리를 만들고,
`POST /api/v1/conversations/search`가 스코프 안의 텍스트를 검색한다.

`backend/logs/chat/*.json` AI 디버그 로그와 대화 기록 DB는 서로 다른 데이터다.

대화 기록 삭제가 AI 로그 파일 삭제를 의미하지 않고, AI 로그 삭제도 대화 기록
삭제를 의미하지 않는다.
