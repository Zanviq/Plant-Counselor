# 공통 AI 대화창

우측에서 열리는 `frontend/components/chat/ChatPanel.tsx` 패널이다.

## 레이아웃

- 패널이 열리면 앱 본문이 왼쪽으로 밀린다.
- 너비는 드래그로 조절한다.
- 사이드바의 `AI 정원사` 버튼이 공통 토글이다.
- 중복 floating FAB는 사용하지 않는다.
- 입력 중이 아닐 때 Space 키로 열 수 있다.

## 스코프

| kind | 의미 |
| --- | --- |
| `global` | 전체 정원 |
| `plant` | 특정 식물 |
| `bud` | 특정 봉우리 |
| `calendar` | 캘린더 |

헤더 breadcrumb로 세션 맥락을 확인하고 이동한다. 현재 맥락과 다른 요청은
`suggest_scope_change` 스킬과 변경 배너로 세션 이동을 제안하며, 확인 시 입력을 새
세션으로 이관한다.

## 기록과 명령어

대화는 DB에 저장되고 `/history`에서 스코프 트리로 탐색한다.

```text
/clear /delete /compact /plants /new /settings /skills /use
```

## 통신

`POST /api/v1/chat/message`의 SSE 이벤트를 수신한다. `tool_result` 이후 관련 TanStack
Query 캐시를 무효화해 식물, 봉우리, 통계, 캘린더 화면을 갱신한다.

## 요청 컨텍스트

| 필드 | 의미 |
| --- | --- |
| `text` | 사용자 입력 |
| `scope` | `global`, `plant`, `bud`, `calendar` |
| `scope_id` | 식물 또는 봉우리 ID |
| `current_screen` | 현재 화면 힌트 |

## 표시 영역

- 헤더: breadcrumb, 스코프, 닫기 버튼
- 대화 영역: 사용자, AI, 시스템 메시지와 Markdown 렌더링
- 스킬 결과: 실행 중인 도구 호출 표시
- 입력 영역: textarea, 전송, 명령어 메뉴
- 세션 변경 배너: 다른 식물 주제 요청을 적절한 세션으로 이관
