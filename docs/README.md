# Plant Counselor 문서 지도

> 최종 점검: 2026-06-02

문서가 여러 구현 단계를 거치며 함께 남아 있다. 현재 웹 MVP 작업은 아래 우선순위로
읽는다.

1. 실제 코드
2. 루트 [`AGENTS.md`](../AGENTS.md)
3. [`Web/`](./Web/)의 최신 웹 문서
4. [`DEMO_GUIDE.md`](./DEMO_GUIDE.md)
5. [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md)

## 현재 작업용 문서

| 문서 | 용도 |
| --- | --- |
| [`Web/00_메인.md`](./Web/00_메인.md) | 웹 구현 개요와 세부 문서 색인 |
| [`Web/05_백엔드/아키텍처_개요.md`](./Web/05_백엔드/아키텍처_개요.md) | 현재 백엔드 계층과 운영 주의사항 |
| [`Web/05_백엔드/API_엔드포인트.md`](./Web/05_백엔드/API_엔드포인트.md) | 현재 사용자 API 요약 |
| [`Web/05_백엔드/인증_세션.md`](./Web/05_백엔드/인증_세션.md) | Supabase 인증 흐름 |
| [`Web/03_LLM/Skill_개요.md`](./Web/03_LLM/Skill_개요.md) | 등록된 AI 스킬 20개 |
| [`DEMO_GUIDE.md`](./DEMO_GUIDE.md) | 수동 시연과 회귀 확인 |
| [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) | Render, Vercel, Supabase 배포 |

## 역사 자료

| 경로 | 의미 |
| --- | --- |
| [`MVP/`](./MVP/) | 2026-05-27 시점 초기 웹 MVP 스냅샷. 현재 구현 명세로 사용하지 않는다. |
| [`Archive/Pygame/`](./Archive/Pygame/) | 웹 이전 Pygame 프로토타입 자료 |
| [`superpowers/plans/`](./superpowers/plans/) | 당시 구현 계획. 완료 후 코드가 바뀐 항목이 있다. |
| [`해야할일.md`](./해야할일.md) | 과거 작업 메모. 현재 개선 후보는 루트 `AGENTS.md`를 우선한다. |

역사 자료에 SQLAlchemy, SQLite, 쿠키 기반 refresh 인증, 강조색 선택, 14~16개 스킬
설명이 남아 있어도 현재 코드에는 적용하지 않는다.

최신 문서를 갱신할 때는 오래된 설명을 현재 코드로 교체하되, 여전히 유효한 구조,
보안 경계, 운영 주의사항, 확장 체크리스트는 삭제하지 않고 보존한다.
