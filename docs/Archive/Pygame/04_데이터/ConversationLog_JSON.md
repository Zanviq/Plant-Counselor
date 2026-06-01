# ConversationLog JSON

> 경로:
> - `data/users/<nickname>/conversations/global.json`
> - `data/users/<nickname>/conversations/plant_<plant_id>.json`
> - `data/users/<nickname>/conversations/bud_<bud_id>.json`

관련 문서: [[Web/01_페이지/공통_AI대화창]], [[Web/03_LLM/LLM_흐름]]

---

## 스키마

| 필드 | 타입 | 설명 |
|---|---|---|
| `scope` | enum | `global`/`plant`/`bud` |
| `scope_id` | string or null | plant/bud의 id |
| `messages` | array | 메시지 배열 |

### messages 항목

| 필드 | 타입 | 설명 |
|---|---|---|
| `at` | string(ISO) |  |
| `role` | enum | `user`/`assistant`/`tool` |
| `text` | string | 본문 |
| `skill_call` | object or null | tool 메시지인 경우 |
| `skill_call.name` | string |  |
| `skill_call.args` | object |  |
| `skill_call.result` | object | Skill 반환 객체 |

---

## 예시

```
{
  "scope": "bud",
  "scope_id": "01HZX-BD-07",
  "messages": [
    {"at": "2026-05-17T18:42:00", "role": "user", "text": "초안 다 썼어"},
    {"at": "2026-05-17T18:42:05", "role": "assistant", "text": "기말 프로젝트 봉우리가 열매로 자랐어요."},
    {"at": "2026-05-17T18:42:05", "role": "tool",
     "text": "",
     "skill_call": {
       "name": "update_bud_progress",
       "args": {"bud_id": "01HZX-BD-07", "progress": 80, "auto_transition": true},
       "result": {"ok": true, "data": {"transitioned": true}}
     }
    }
  ]
}
```

---

## 관련 클래스
- [[클래스_함수_사전#ConversationManager]]
