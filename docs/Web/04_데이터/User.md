# User 테이블

> 인증과 사용자별 설정.

관련 문서: [[DB_스키마]], [[인증_세션]], [[Web/01_페이지/설정]]

---

## 컬럼

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | string | PK (ULID) |
| `email` | string | UNIQUE, NOT NULL |
| `nickname` | string | UNIQUE, 2~16자 |
| `password_hash` | string | argon2id |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `address` | string | AI 호칭(기본 = nickname) |
| `tone` | enum | `counselor` / `assistant` / `friend` |
| `timezone` | string | IANA TZ. 기본 `Asia/Seoul` |
| `appearance` | JSON | `{ theme, animation }` |
| `sound` | JSON | `{ sfx, bgm, volume }` |
| `garden_rules` | JSON | `{ wilting_days, wilting_review_extra_days, rot_disappear_days, deadline_warn_days, auto_transition }` |
| `ai` | JSON | `{ model, proactive }` |
| `encrypted_api_key` | bytes | LLM API 키(서버 측 대칭암호화) |
| `last_login_at` | timestamptz | |

---

## 예시 JSON 응답 (`GET /me`)

```
{
  "id": "01HZX...",
  "email": "jaemin@example.com",
  "nickname": "jaemin",
  "address": "재민",
  "tone": "counselor",
  "timezone": "Asia/Seoul",
  "appearance": { "theme": "auto", "animation": "subtle" },
  "sound": { "sfx": true, "bgm": false, "volume": 0.6 },
  "garden_rules": {
    "wilting_days": 7,
    "wilting_review_extra_days": 7,
    "rot_disappear_days": 14,
    "deadline_warn_days": 3,
    "auto_transition": true
  },
  "ai": { "proactive": true },
  "api_key_set": true
}
```

`password_hash`, `encrypted_api_key` 등은 응답에 포함되지 않는다. `api_key_set`은 키 보유 여부만 부울로.

---

## 인덱스

- `email` UNIQUE
- `nickname` UNIQUE
