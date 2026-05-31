# API 클라이언트

관련 문서: [[API_엔드포인트]], [[인증_세션]], [[상태관리]], [[채팅_스트리밍]]

---

## 기본 fetch 래퍼 (`lib/api/client.ts`)

책임:

1. 베이스 URL 부착 (`NEXT_PUBLIC_API_BASE`).
2. `authStore`의 액세스 토큰을 `Authorization: Bearer` 헤더에 자동 부착.
3. 401 응답 수신 → `POST /auth/refresh` 호출 → 새 토큰 Zustand 저장 → 원래 요청 한 번 재시도.
4. JSON 응답을 `{ ok, data, error }` 형태로 표준화.
5. 네트워크 오류는 표준 에러 객체로 감싸 throw.

```typescript
type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }
```

---

## 자원별 모듈

- `lib/api/plants.ts` — `listPlants`, `getPlant`, `updatePlant`, `deletePlant`
- `lib/api/buds.ts` — `listBuds`, `getBud`, `patchBud`
- `lib/api/stats.ts` — `getSummary`, `getFullStats`, `getCalendar`, `getBriefing`
- `lib/api/auth.ts` — `signup`, `login`, `refreshToken`, `logout`, `apiGet` (용도: /me 등)
- `lib/api/client.ts` — 공통 `streamChat` 포함

---

## SSE 파서 (`streamChat`)

`fetch`로 POST 요청 후 `response.body`를 `ReadableStream`으로 받아 `TextDecoder`로 SSE 프레임 분해.

```typescript
streamChat(
  { text, scope, scope_id, current_screen },
  {
    onToken: (chunk) => void,
    onToolResult: (name) => void,
    onDone: () => void,
    onError: (code, message) => void,
  }
)
```

`onConfirmationRequired` 콜백은 **존재하지 않는다** — 동의 확인은 LLM의 텍스트 응답으로 처리.

---

## 에러 처리 정책

| 코드 | 처리 |
|---|---|
| `401` | 자동 리프레시 후 1회 재시도. 그래도 실패 시 `/login` 리다이렉트 |
| `403` | 토스트 + 안내 |
| `404` | Next.js 404 라우트로 위임 |
| `422` | 의존성 주입 단계 오류 (인증 미구현 구간) — `deps.py` 수정으로 대부분 해결됨 |
| `429` | 지수 백오프 재시도 |
| `5xx` | 토스트 + 재시도 버튼 |

---

## 인증 복원 흐름

```
앱 로드
  ↓
(app)/layout.tsx restore()
  ↓
refreshToken() → { access_token }
  ↓
useAuthStore.setState({ accessToken })  ← 먼저 저장
  ↓
apiGet("/me")  ← 이제 헤더에 토큰이 담김
```
