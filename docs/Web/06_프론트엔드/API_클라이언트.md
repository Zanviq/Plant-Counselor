# API 클라이언트

> 최종 점검: 2026-06-02

관련 문서: [[API_엔드포인트]], [[인증_세션]], [[상태관리]], [[채팅_스트리밍]]

## 공통 래퍼

`frontend/lib/api/client.ts`가 `NEXT_PUBLIC_API_BASE`를 기준으로 백엔드에 직접
요청한다. Next.js `proxy.ts`는 API proxy가 아니다.

`configureClient()`는 앱 레이아웃에서 Supabase 세션 접근자를 연결한다.

1. 현재 access token을 `Authorization: Bearer ...`로 추가한다.
2. 일반 API가 401을 반환하면 `supabase.auth.refreshSession()`을 한 번 시도한다.
3. 네트워크 오류를 `{ ok: false, error }` 형태로 변환한다.
4. 관리자 백업 다운로드는 Bearer 헤더를 보낼 수 있도록 blob으로 가져온다.

```typescript
type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }
```

## 자원별 모듈

- `lib/api/plants.ts`
- `lib/api/buds.ts`
- `lib/api/stats.ts`
- `lib/api/admin.ts`
- `lib/api/client.ts`: 공통 요청과 `streamChat()`

## SSE

`streamChat()`은 `fetch`와 `ReadableStream`으로 `/chat/message` 응답을 파싱한다.
일반 JSON 래퍼와 별도 코드 경로이므로 인증이나 오류 정책을 바꿀 때 둘 다 확인한다.

## 오류 처리

| 상황 | 처리 |
| --- | --- |
| 일반 fetch 네트워크 오류 | `{ ok: false, error: { code: "network", ... } }` |
| 일반 API 401 | Supabase refresh 후 한 번 재시도 |
| 다운로드 실패 | 사용자에게 문자열 오류 반환 |
| SSE 연결 실패 | `onError("network", ...)`와 `onDone()` 호출 |

`streamChat()`은 일반 `apiFetch()`와 별도 경로이므로 인증 재시도 정책을 변경할 때
채팅 스트림도 따로 확인한다.
