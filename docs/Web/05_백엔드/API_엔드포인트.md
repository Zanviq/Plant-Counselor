# API 엔드포인트

> 모든 엔드포인트는 `/api/v1` 프리픽스, JSON 입출력. 별도 명시가 없으면 인증 필요(JWT 액세스 토큰).

관련 문서: [[인증_세션]], [[Web/03_LLM/Skill_개요]], [[채팅_스트리밍]], [[도메인_서비스]]

---

## 인증 / 계정

| 메서드 | 경로 | 설명 | 인증 |
|---|---|---|---|
| POST | `/auth/signup` | 회원가입(이메일, 비밀번호, 닉네임) | ✗ |
| POST | `/auth/login` | 로그인 → 액세스 토큰(바디) + 리프레시 쿠키 | ✗ |
| POST | `/auth/refresh` | 액세스 토큰 재발급 | (refresh 쿠키) |
| POST | `/auth/logout` | 리프레시 쿠키 폐기 | ✓ |
| GET | `/me` | 현재 사용자 프로필 | ✓ |
| PATCH | `/me` | 닉네임/호칭/톤/테마 등 부분 갱신 | ✓ |
| POST | `/me/password` | 비밀번호 변경 | ✓ |
| DELETE | `/me` | 계정 삭제 | ✓ |

> `/me/api-key` (Gemini 키 관리) 엔드포인트는 향후 사용자별 키 지원 시 활성화.

---

## 식물(Plant)

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/plants` | 식물 목록 |
| GET | `/plants/{plant_id}` | 식물 상세(봉우리 수, 통계 포함) |
| PATCH | `/plants/{plant_id}` | 분야명/설명 수정 |
| DELETE | `/plants/{plant_id}` | 식물 삭제(soft delete) |

> 식물 생성/삭제는 LLM Skill(`create_plant`, `delete_plant`)을 통해서만. 직접 POST 없음.

---

## 봉우리(Bud)

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/buds` | 봉우리 목록(쿼리: `plant_id`, `statuses`, `wilting_only` 등) |
| GET | `/buds/{bud_id}` | 봉우리 상세 + 상태 이력 |
| PATCH | `/buds/{bud_id}` | 제목·설명만 직접 수정 가능 |

> 상태 전이, 진행률, 마감일, 포기, 수확은 LLM Skill로만 처리.

---

## 통계 / 캘린더

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/stats/summary` | 홈 요약 카드 값 |
| GET | `/calendar?from=...&to=...` | 캘린더 셀별 봉우리 분포 |
| GET | `/briefing/today` | 오늘의 정원 메시지 |

---

## 알림

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/notifications` | 미확인 알림 목록 |
| POST | `/notifications/{id}/ack` | 확인 처리 |

---

## 대화 / 채팅

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/chat/message` | 사용자 발화 전송. 응답: SSE 스트림 |
| GET | `/conversations?scope=...&scope_id=...` | 대화 히스토리 조회 |

`/chat/message` 요청 바디:
```json
{
  "text": "사용자 발화",
  "scope": "global",
  "scope_id": null,
  "current_screen": "웹"
}
```

스트림 포맷: [[채팅_스트리밍]].

---

## 백업

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/me/export` | 사용자 데이터 zip 다운로드 |
| POST | `/me/import` | 데이터 복원 |

---

## 공통 응답 형식

성공:
```json
{ "ok": true, "data": "..." }
```

실패:
```json
{
  "ok": false,
  "error": { "code": "not_found", "message": "..." }
}
```

HTTP 상태: 401 인증 오류, 403 권한, 404 없음, 409 충돌, 422 검증 실패.

---

## OpenAPI

FastAPI 자동 생성: `/api/v1/openapi.json`, Swagger UI: `/docs` (개발 환경만).
