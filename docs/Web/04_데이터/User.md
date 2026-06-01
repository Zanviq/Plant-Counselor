# profiles 테이블

Supabase Auth 사용자의 애플리케이션 프로필이다.

## 주요 필드

| 필드 | 의미 |
| --- | --- |
| `id` | Supabase Auth JWT의 `sub` |
| `email` | Google 계정 이메일 |
| `nickname` | 표시 이름 |
| `role` | `user` 또는 `admin` |
| `tone` | AI 응답 톤 |
| `ai_model` | 사용자별 모델 override |
| `garden_rules` | 자동 전이 기준 |
| `appearance` | 사용자 표시 설정 |
| `encrypted_api_key` | Fernet으로 암호화한 사용자 Gemini API 키 |
| `created_at` | 생성 시각 |

프로필이 없는 사용자의 유효한 Supabase JWT가 처음 들어오면 `require_user()`가 이메일과
메타데이터로 프로필을 생성한다.

`encrypted_api_key` 평문은 API 응답으로 반환하지 않는다.
