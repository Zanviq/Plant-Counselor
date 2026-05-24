# User JSON

> 경로: `data/users/<nickname>/user.json`

관련 문서: [[폴더_구조]], [[회원가입_로그인]], [[설정]]

---

## 스키마

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string | 내부 사용자 id (ULID) |
| `nickname` | string | 닉네임 (폴더명과 동일) |
| `password_hash` | string | 해시 + 솔트 |
| `created_at` | string(ISO) | 생성 시각 |
| `address` | string | AI가 사용자를 부르는 호칭 |
| `tone` | enum | `counselor`/`assistant`/`friend` |
| `ai` | object | AI 관련 설정 |
| `ai.model` | string | 사용 모델 식별자 |
| `ai.proactive` | bool | 자발 발화 사용 여부 |
| `garden_rules` | object | [[상태_자동전이]] 임계값 |
| `garden_rules.wilting_days` | integer | 기본 7 |
| `garden_rules.wilting_review_extra_days` | integer | 기본 7 |
| `garden_rules.rot_disappear_days` | integer | 기본 14 |
| `garden_rules.deadline_warn_days` | integer | 기본 3 |
| `garden_rules.auto_transition` | bool | 기본 true |
| `appearance` | object | 테마 설정 |
| `appearance.theme` | enum | `spring`/`summer`/`autumn`/`winter`/`night`/`auto` |
| `appearance.animation` | enum | `none`/`subtle`/`rich` |
| `sound` | object | 사운드 설정 |
| `sound.sfx` | bool |  |
| `sound.bgm` | bool |  |
| `sound.volume` | number(0~1) |  |

---

## 예시

```
{
  "id": "01HZX...",
  "nickname": "jaemin",
  "password_hash": "argon2id$...",
  "created_at": "2026-05-18T09:12:00",
  "address": "재민",
  "tone": "counselor",
  "ai": { "model": "claude-opus-4-7", "proactive": true },
  "garden_rules": {
    "wilting_days": 7,
    "wilting_review_extra_days": 7,
    "rot_disappear_days": 14,
    "deadline_warn_days": 3,
    "auto_transition": true
  },
  "appearance": { "theme": "auto", "animation": "subtle" },
  "sound": { "sfx": true, "bgm": false, "volume": 0.6 }
}
```

---

## 관련 클래스
- [[클래스_함수_사전#UserManager]]
- [[클래스_함수_사전#FileStore]]
