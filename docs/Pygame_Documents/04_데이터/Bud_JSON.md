# Bud JSON

> 경로: `data/users/<nickname>/plants/<plant_id>/buds/<bud_id>.json`

관련 문서: [[봉우리_생애주기]], [[상태_자동전이]], [[Plant_JSON]]

---

## 스키마

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string | 봉우리 id |
| `plant_id` | string | 소속 식물 |
| `title` | string | 제목(짧게) |
| `detail` | string | 부가 설명 |
| `type` | enum | `concern` / `schedule` |
| `status` | enum | `seed`/`bud`/`flower`/`fruit`/`harvested`/`wilting`/`rot` |
| `progress` | integer | 0~100 |
| `created_at` | string(ISO) |  |
| `last_progress_at` | string(ISO) | 마지막 진행 시각 |
| `deadline` | string(ISO date) or null | 마감일 |
| `history` | array | 상태 변경 이력 |
| `disappeared_at` | string(ISO) or null | rot이 시각적으로 사라진 시각 |

### history 항목

| 필드 | 타입 | 설명 |
|---|---|---|
| `from` | string | 이전 상태 |
| `to` | string | 새 상태 |
| `at` | string(ISO) |  |
| `reason` | string | 자유 텍스트 (`auto:...`, `user:...`) |

---

## 예시

```
{
  "id": "01HZX-BD-07",
  "plant_id": "01HZX-PL-01",
  "title": "기말 프로젝트 마무리",
  "detail": "데이터 시각화 과제 보고서까지 포함",
  "type": "schedule",
  "status": "fruit",
  "progress": 80,
  "created_at": "2026-05-01T09:00:00",
  "last_progress_at": "2026-05-17T18:42:11",
  "deadline": "2026-05-25",
  "history": [
    {"from": "seed", "to": "bud", "at": "2026-05-01T09:00:05", "reason": "auto:initial"},
    {"from": "bud", "to": "flower", "at": "2026-05-08T12:00:00", "reason": "user:본격적으로 시작"},
    {"from": "flower", "to": "fruit", "at": "2026-05-17T18:42:11", "reason": "auto:progress>=75"}
  ],
  "disappeared_at": null
}
```

---

## 관련 클래스
- [[클래스_함수_사전#BudManager]]
- [[클래스_함수_사전#StateTransitionEngine]]
