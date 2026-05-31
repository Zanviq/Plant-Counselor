# AI 연동

> LLM과의 통신 계층 구조.

관련 문서: [[LLM_흐름]], [[Skill_개요]], [[시스템_프롬프트]], [[클래스_함수_사전]]

---

## 주요 구성 요소

### LLMClient

- 외부 LLM API를 호출하는 단일 진입점.
- 키: `chat(messages, tools)`, `set_model`, `set_api_key`.
- 모델 카탈로그, 키 저장 위치, 재시도/타임아웃 정책을 갖는다.

### PromptBuilder

- [[시스템_프롬프트]] 템플릿에 변수를 채워 최종 프롬프트 메시지를 만든다.
- 키: `build_system`, `build_tools_catalog`, `embed_context`.

### SkillRegistry

- [[Skill_개요]]의 Skill 객체들을 등록/조회/dispatch.
- 키: `register`, `get`, `list`, `build_catalog`, `dispatch(name, args)`.

### Skill 베이스

- 각 Skill 구현이 상속하는 추상 클래스.
- 필수 속성: `name`, `description`, `parameters`(JSON Schema), `requires_confirmation`.
- 필수 메서드: `run(args, ctx) -> { ok, message, data, error_code }`.

### ChatController

- UI([[클래스_함수_사전#ChatWidget]])와 LLM 계층의 중간 컨트롤러.
- 키: `send_user_message`, `collect_context`, `handle_assistant_response`, `confirm_and_dispatch`.

### 모델 카탈로그

- 사용자가 [[설정#2-AI-설정]]에서 선택할 모델 목록.
- 모델별 토큰 한도, 도구 사용 형식(Anthropic/OpenAI) 메타데이터.

### 키 저장

- API 키는 `data/users/<nickname>/keys.bin`에 저장.
- 가능하면 OS 자격 증명 저장소 또는 사용자 비밀번호 기반 키로 암호화.
- 평문 저장 옵션은 경고와 함께 허용.

---

## 호출 시퀀스(요약)

1. [[클래스_함수_사전#ChatController]].`send_user_message`
2. `collect_context()` → [[PromptBuilder]] → 최종 messages
3. [[LLMClient]].`chat(messages, tools=SkillRegistry.build_catalog())`
4. 응답 분석:
   - tool_use 있으면 → 확인 필요 동작이면 사용자 확인 후 [[SkillRegistry]].`dispatch`
   - dispatch 결과를 다시 LLM에 전달해 최종 자연어 응답 합성
5. [[ConversationManager]].`append`
