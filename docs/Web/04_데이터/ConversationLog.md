# ConversationLog 테이블

> 대화 스코프와 메시지를 별개 테이블로 정규화.

관련 문서: [[DB_스키마]], [[Web/01_페이지/공통_AI대화창]], [[Web/03_LLM/LLM_흐름]]

---

## `conversations`

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | string | PK |
| `user_id` | string | FK |
| `scope` | enum | `global` / `plant` / `bud` |
| `scope_id` | string | nullable (scope=`global`이면 null) |
| `created_at` | timestamptz | |

UNIQUE: `(user_id, scope, scope_id)`.

## `conversation_messages`

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | string | PK |
| `conversation_id` | string | FK |
| `at` | timestamptz | |
| `role` | enum | `user` / `assistant` / `tool` |
| `text` | text | |
| `skill_call` | JSON | role=`tool`일 때만: `{ name, args, result }` |

INDEX: `(conversation_id, at)`.

---

## 검색

`search_conversation` Skill은 `conversation_messages.text`에 대한 단순 ILIKE 검색을 기본으로 사용.
나중에 PostgreSQL의 `pg_trgm`이나 임베딩 검색으로 확장.

---

## 응답 예시 (`GET /conversations?scope=bud&scope_id=...`)

```
{
  "scope": "bud",
  "scope_id": "01HZX-BD-07",
  "messages": [
    {"at": "...", "role": "user",      "text": "초안 다 썼어"},
    {"at": "...", "role": "assistant", "text": "기말 프로젝트 봉우리가 열매로 자랐어요."},
    {"at": "...", "role": "tool",      "text": "", "skill_call": {
      "name": "update_bud_progress",
      "args": {"bud_id": "01HZX-BD-07", "progress": 80, "auto_transition": true},
      "result": {"ok": true, "data": {"transitioned": true}}
    }}
  ]
}
```
