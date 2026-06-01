# Skill: search_conversation

> 과거 대화 로그를 검색한다.

관련 문서: [[Web/03_LLM/Skill_개요]], [[ConversationLog_JSON]]

---

## 설명(LLM 용)

사용자가 "내가 저번에 뭐라고 했더라", "지난주 자소서 얘기 다시 보여줘" 등 과거 발화를 참조할 때 호출.

---

## 파라미터

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `query` | string | 필수 | 검색어 |
| `scope` | enum(`global`,`plant`,`bud`) | 선택 | 기본 `global` |
| `scope_id` | string | 선택 | scope가 plant/bud일 때 |
| `limit` | integer | 선택 | 기본 10 |

---

## 반환

- `ok`: bool
- `data.matches`: 메시지 배열(시간, 화자, 본문, 소속 스코프)

---

## 사전 검증

- scope가 `plant`/`bud`인데 `scope_id`가 없으면 실패.

---

## 내부 동작

[[클래스_함수_사전#ConversationManager]].`search(query, scope, scope_id, limit)` — 기본은 단순 문자열 매칭. 후일 임베딩 검색으로 확장 가능.

---

## 확인 필요 여부

아니오.

---

## 연결되는 함수
- [[클래스_함수_사전#ConversationManager]].`search`
