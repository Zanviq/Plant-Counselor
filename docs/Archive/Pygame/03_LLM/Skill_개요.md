# Skill 개요

> LLM이 프로그램의 데이터를 조회/조작하기 위해 호출하는 도구 집합.

관련 문서: [[Archive/Pygame/03_LLM/LLM_흐름]], [[Archive/Pygame/03_LLM/시스템_프롬프트]], [[Web/05_백엔드/AI_연동]]

---

## 왜 Skill인가

LLM이 단순 텍스트로만 응답하면 데이터를 바꿀 수 없다. Skill은 "LLM이 호출 가능한 함수"의 명세이며, 각 Skill은 [[클래스_함수_사전#Manager_클래스들]]의 메서드를 안전하게 감싼다.

---

## Skill의 구성 요소

각 Skill 문서는 다음 항목을 반드시 가진다.

- **이름** (영문 snake_case)
- **설명** (LLM이 언제 호출할지 결정할 자연어 설명)
- **파라미터** (이름, 타입, 필수 여부, 설명)
- **반환** (`ok`, `message`, `data`)
- **연결되는 내부 함수/클래스 메서드**
- **확인 필요 여부**

세부 Skill 파일들:
- [[match_plant]]
- [[create_plant]]
- [[delete_plant]]
- [[create_bud]]
- [[update_bud_status]]
- [[update_bud_progress]]
- [[set_deadline]]
- [[abandon_bud]]
- [[harvest_bud]]
- [[list_plants]]
- [[list_buds]]
- [[get_statistics]]
- [[get_garden_briefing]]
- [[search_conversation]]

---

## 카탈로그 제공 방식

- 매 LLM 호출 시 [[클래스_함수_사전#SkillRegistry]].`build_catalog()`이 모든 Skill의 이름/설명/파라미터 스키마를 JSON으로 만들어 [[Archive/Pygame/03_LLM/시스템_프롬프트#5-Skill-카탈로그]] 자리에 삽입.
- LLM은 Anthropic/OpenAI 호환의 tool-use 형식으로 Skill을 호출한다.

---

## 등록 방식

- 각 Skill 클래스는 [[클래스_함수_사전#Skill_베이스]]를 상속.
- 앱 시작 시 [[클래스_함수_사전#SkillRegistry]].`register(skill)`로 모든 Skill을 등록.
- 등록 순서는 동작에 영향을 주지 않는다.

---

## 권한 범위

모든 Skill은 **현재 로그인된 사용자의 데이터에만** 접근한다. [[클래스_함수_사전#PathResolver]]가 다른 사용자 폴더로의 접근을 차단한다.

---

## 확인 필요 동작

다음 Skill은 LLM이 호출 의도를 표시한 뒤 사용자 동의를 받아야 실제 실행된다.

- [[create_plant]]
- [[delete_plant]]
- [[abandon_bud]]
- [[set_deadline]] (기존 마감일이 있을 때)

---

## 에러 처리

- 파라미터 검증 실패: `ok=false`, `message="..."`, `error_code="invalid_argument"`.
- 대상 없음(존재하지 않는 봉우리/식물): `error_code="not_found"`.
- 권한 위반: `error_code="forbidden"`.
- 모든 에러는 [[클래스_함수_사전#SkillRegistry]]에서 일관 형식으로 LLM에 전달.

---

## 관련 클래스
- [[클래스_함수_사전#Skill_베이스]]
- [[클래스_함수_사전#SkillRegistry]]
- [[클래스_함수_사전#LLMClient]]
