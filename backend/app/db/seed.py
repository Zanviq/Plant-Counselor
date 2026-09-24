"""Demo seed data.

Run with ``python -m app.db.seed`` (the backend container does this after
``alembic upgrade head``). The script is idempotent: if the ``demo`` user
already exists nothing is inserted.

Accounts
    demo  / demo1234   regular user with a populated garden
    admin / admin1234  administrator (admin console)

All dates are relative to "today" in the app timezone so the calendar, deadline
warnings and wilting states look current whenever the database is created.
The seeded chat history and AI logs are pre-written sample conversations, so
the history screens are populated without calling the Gemini API.
"""
from __future__ import annotations

import logging
import secrets
from datetime import date, datetime, time, timedelta

from ulid import ULID

import app.runtime_settings as rs
from app.db.pg import Client, get_client
from app.security import hash_password

logger = logging.getLogger("seed")

NOW = rs.real_now()
TODAY = NOW.date()


def _id() -> str:
    return str(ULID())


def _at(days_ago: float, hour: int | None = None, minute: int = 0) -> str:
    """ISO timestamp `days_ago` days before now (optionally at a fixed local time)."""
    ts = NOW - timedelta(days=days_ago)
    if hour is not None:
        ts = ts.replace(hour=hour, minute=minute, second=0, microsecond=0)
    return ts.isoformat()


def _day(offset: int) -> str:
    return (TODAY + timedelta(days=offset)).isoformat()


# ── users ─────────────────────────────────────────────────────────────────────

def _create_user(db: Client, username: str, password: str, nickname: str, role: str = "user",
                 email: str | None = None, days_ago: int = 30) -> str:
    uid = _id()
    db.table("users").insert({
        "id": uid,
        "username": username,
        "password_hash": hash_password(password),
        "email": email,
        "nickname": nickname,
        "role": role,
        "created_at": _at(days_ago),
    }).execute()
    return uid


# ── garden ────────────────────────────────────────────────────────────────────

def _plant(db: Client, uid: str, name: str, description: str, days_ago: int) -> str:
    pid = _id()
    db.table("plants").insert({
        "id": pid, "user_id": uid, "name": name, "description": description,
        "created_at": _at(days_ago),
    }).execute()
    return pid


# Lifecycle order used to write a plausible bud_history trail.
_TRAIL = {
    "bud": ["bud"],
    "flower": ["bud", "flower"],
    "fruit": ["bud", "flower", "fruit"],
    "harvested": ["bud", "flower", "fruit", "harvested"],
    "wilting": ["bud", "wilting"],
    "rot": ["bud", "wilting", "rot"],
}
_REASON = {
    "bud": "생성",
    "flower": "진행도 60% 자동 전이",
    "fruit": "진행도 85% 자동 전이",
    "harvested": "수확",
    "wilting": "시들기 시작",
    "rot": "오래 방치되어 썩음",
}


def _bud(db: Client, uid: str, pid: str, title: str, *, detail: str = "", type: str = "concern",
         status: str = "bud", progress: int = 0, deadline: int | None = None,
         created_days_ago: int = 14, last_days_ago: float = 1) -> str:
    bid = _id()
    row = {
        "id": bid, "user_id": uid, "plant_id": pid, "title": title, "detail": detail,
        "type": type, "status": status, "progress": progress,
        "deadline": _day(deadline) if deadline is not None else None,
        "last_progress_at": _at(last_days_ago),
        "created_at": _at(created_days_ago),
    }
    if status == "rot":
        row["disappeared_at"] = _at(max(last_days_ago - 1, 0))
    db.table("buds").insert(row).execute()

    trail = _TRAIL[status]
    span = max(created_days_ago - last_days_ago, 0.5)
    history = []
    prev = ""
    for i, st in enumerate(trail):
        at = created_days_ago - span * (i / max(len(trail) - 1, 1)) if len(trail) > 1 else created_days_ago
        history.append({
            "id": _id(), "bud_id": bid, "from_status": prev, "to_status": st,
            "at": _at(at), "reason": _REASON[st],
        })
        prev = st
    db.table("bud_history").insert(history).execute()
    # updated_at is maintained by trigger; pin it to the last activity for realism.
    db.table("buds").update({"updated_at": _at(last_days_ago)}).eq("id", bid).execute()
    return bid


def _event(db: Client, uid: str, title: str, start: int, *, end: int | None = None,
           at: tuple[int, int] | None = None, until: tuple[int, int] | None = None,
           color: str = "olive", repeat: str = "none", detail: str = "", plant_id: str | None = None) -> None:
    all_day = at is None
    db.table("calendar_events").insert({
        "id": _id(), "user_id": uid, "plant_id": plant_id, "title": title, "detail": detail,
        "event_date": _day(start), "end_date": _day(end if end is not None else start),
        "event_time": None if all_day else time(*at).isoformat(),
        "end_time": None if all_day else time(*(until or (at[0] + 1, at[1]))).isoformat(),
        "all_day": all_day, "repeat_rule": repeat, "color": color,
    }).execute()


def _conversation(db: Client, uid: str, scope: str, scope_id: str | None,
                  turns: list[tuple[str, str, dict | None]], start_days_ago: float) -> None:
    cid = _id()
    db.table("conversations").insert({
        "id": cid, "user_id": uid, "scope": scope, "scope_id": scope_id,
        "created_at": _at(start_days_ago),
    }).execute()
    rows = []
    for i, (role, text, skill_call) in enumerate(turns):
        rows.append({
            "id": _id(), "conversation_id": cid, "role": role, "text": text,
            "skill_call": skill_call, "at": _at(start_days_ago - i * 0.002),
        })
    db.table("conversation_messages").insert(rows).execute()
    db.table("conversations").update({"updated_at": rows[-1]["at"]}).eq("id", cid).execute()


def _ai_log(db: Client, uid: str, days_ago: float, user_input: str, final: str,
            skills: list[dict]) -> None:
    ts = NOW - timedelta(days=days_ago)
    filename = f"{ts.strftime('%Y%m%d_%H%M%S_%f')[:22]}_{uid[:8]}.json"
    llm_calls = [{
        "call": i + 1,
        "messages_count": 1 + i * 2,
        "tools_count": 20,
        "messages": [{"role": "user", "content": user_input}],
        "result_text": "" if i < len(skills) else final,
        "result_tool_use": ({"name": s["name"], "input": s["args"]} if i < len(skills) else None),
    } for i, s in enumerate(skills + [{}])]
    data = {
        "timestamp": ts.isoformat(),
        "user_id": uid,
        "user_input": user_input,
        "system_prompt": "(sample log — generated by the seed script)",
        "history": [],
        "llm_calls": llm_calls,
        "skill_calls": skills,
        "final_response": final,
        "events": [{"time": ts.isoformat(), "type": "done", "detail": f"response_len={len(final)}"}],
        "llm_errors": [],
    }
    db.table("ai_logs").insert({
        "filename": filename, "user_id": uid, "created_at": ts.isoformat(), "data": data,
    }).execute()


# ── scenario ──────────────────────────────────────────────────────────────────

def _seed_demo(db: Client, uid: str) -> None:
    job = _plant(db, uid, "취업 준비", "하반기 공채 지원과 포트폴리오 정리", 40)
    health = _plant(db, uid, "건강", "운동 루틴과 수면 습관 만들기", 35)
    study = _plant(db, uid, "공부", "정보처리기사 실기와 영어 공부", 30)
    daily = _plant(db, uid, "일상", "집안일과 소소한 생활 목표", 25)

    portfolio = _bud(db, uid, job, "포트폴리오 사이트 리뉴얼",
                     detail="프로젝트 3개 정리, 회고 글 추가, 반응형 점검",
                     status="fruit", progress=90, created_days_ago=21, last_days_ago=0.3)
    _bud(db, uid, job, "코딩 테스트 주 3회 풀기", detail="백준 골드 문제 위주",
         status="flower", progress=65, created_days_ago=18, last_days_ago=1)
    apply_a = _bud(db, uid, job, "A사 서류 마감", type="schedule",
                   detail="자기소개서 4문항 + 포트폴리오 링크 제출",
                   progress=40, deadline=2, created_days_ago=10, last_days_ago=0.5)
    _bud(db, uid, job, "기술 면접 스터디 준비", type="schedule",
         detail="운영체제·네트워크 질문 정리", progress=20, deadline=9,
         created_days_ago=6, last_days_ago=2)
    _bud(db, uid, job, "자기소개서 초안 완성", status="harvested", progress=100,
         created_days_ago=20, last_days_ago=3)

    _bud(db, uid, health, "주 3회 30분 러닝", detail="한강 코스, 페이스 6분대 유지",
         status="flower", progress=70, created_days_ago=28, last_days_ago=1)
    sleep = _bud(db, uid, health, "밤 12시 전에 잠들기", detail="자기 전 휴대폰 멀리 두기",
                 status="wilting", progress=30, created_days_ago=26, last_days_ago=9)
    _bud(db, uid, health, "건강검진 예약하기", type="schedule", progress=0, deadline=12,
         created_days_ago=4, last_days_ago=4)

    _bud(db, uid, study, "정보처리기사 실기 기출 5회분", detail="회차별 오답 노트 작성",
         progress=55, deadline=20, created_days_ago=15, last_days_ago=1)
    _bud(db, uid, study, "영어 단어 하루 30개", status="fruit", progress=85,
         created_days_ago=24, last_days_ago=0.8)
    _bud(db, uid, study, "알고리즘 책 1권 완독", status="harvested", progress=100,
         created_days_ago=29, last_days_ago=5)

    _bud(db, uid, daily, "안 쓰는 물건 정리해서 기부하기", status="flower", progress=60,
         created_days_ago=12, last_days_ago=2)
    _bud(db, uid, daily, "가계부 꾸준히 쓰기", status="rot", progress=20,
         created_days_ago=24, last_days_ago=3)
    _bud(db, uid, daily, "화분 분갈이", progress=10, created_days_ago=3, last_days_ago=3)

    for pid, days in ((job, 0.3), (health, 1), (study, 0.8), (daily, 2)):
        db.table("plants").update({"last_activity_at": _at(days)}).eq("id", pid).execute()

    _event(db, uid, "치과 정기검진", 2, at=(14, 0), until=(15, 0), color="blue", plant_id=health)
    _event(db, uid, "팀 프로젝트 회의", -5, at=(19, 0), until=(20, 30), color="purple",
           repeat="weekly", detail="진행 상황 공유, 다음 스프린트 계획")
    _event(db, uid, "동아리 MT", 6, end=7, color="yellow", detail="가평, 1박 2일")
    _event(db, uid, "도서관 책 반납", 4, color="olive", plant_id=study)
    _event(db, uid, "PT 수업", -2, at=(7, 0), until=(8, 0), color="red", plant_id=health)
    _event(db, uid, "엄마 생신", 15, color="pink", detail="케이크 예약하기")
    _event(db, uid, "스터디 카페 결제일", 10, color="olive", repeat="monthly")

    _conversation(db, uid, "global", None, [
        ("user", "이번 주에 챙겨야 할 거 정리해줘", None),
        ("assistant",
         "이번 주 정원 상황을 정리했어요.\n\n"
         "**마감이 가까운 일정**\n"
         f"- **A사 서류 마감** — {_day(2)} (진행률 40%)\n"
         f"- **치과 정기검진** — {_day(2)} 14:00\n"
         f"- **도서관 책 반납** — {_day(4)}\n\n"
         "**신경 쓰면 좋은 봉우리**\n"
         "- `밤 12시 전에 잠들기`가 9일째 변화가 없어 시들고 있어요.\n"
         "- `포트폴리오 사이트 리뉴얼`은 90%라 조금만 더 하면 수확할 수 있어요.\n\n"
         "A사 서류부터 먼저 마무리하는 걸 추천해요.",
         {"name": "list_calendar_events", "input": {"from": _day(0), "to": _day(7)}}),
    ], start_days_ago=0.2)

    _conversation(db, uid, "plant", job, [
        ("user", "포트폴리오 회고 글까지 다 써서 90%까지 왔어", None),
        ("assistant",
         "좋아요! **포트폴리오 사이트 리뉴얼** 진행률을 **90%**로 올렸어요. 🍎 열매 단계예요.\n\n"
         "남은 10%는 반응형 점검 정도로 보이는데, 끝나면 말해 주세요. 바로 수확해 드릴게요.",
         {"name": "update_bud_progress", "input": {"bud_id": portfolio, "progress": 90}}),
    ], start_days_ago=0.3)

    _conversation(db, uid, "bud", apply_a, [
        ("user", "자소서 2번 문항까지 썼어. 진행률 40으로 해줘", None),
        ("assistant",
         "**A사 서류 마감** 진행률을 **40%**로 기록했어요.\n\n"
         f"마감이 {_day(2)}이라 이틀 남았어요. 오늘 3번 문항, 내일 4번 문항과 최종 검토를 하면 여유 있게 낼 수 있어요.",
         {"name": "update_bud_progress", "input": {"bud_id": apply_a, "progress": 40}}),
    ], start_days_ago=0.5)

    _conversation(db, uid, "calendar", None, [
        ("user", "모레 오후 2시에 치과 검진 일정 넣어줘. 파란색으로", None),
        ("assistant",
         f"**치과 정기검진** 일정을 {_day(2)} 14:00–15:00에 파란색으로 추가했어요. 겹치는 일정은 없어요.",
         {"name": "create_calendar_event",
          "input": {"title": "치과 정기검진", "date": _day(2), "time": "14:00", "color": "파랑"}}),
    ], start_days_ago=1.2)

    db.table("notifications").insert([
        {"id": _id(), "user_id": uid, "kind": "deadline_warning",
         "payload": {"bud_id": apply_a, "title": "A사 서류 마감", "deadline": _day(2)},
         "created_at": _at(0.4)},
        {"id": _id(), "user_id": uid, "kind": "bud_wilting",
         "payload": {"bud_id": sleep, "title": "밤 12시 전에 잠들기"},
         "created_at": _at(2)},
        {"id": _id(), "user_id": uid, "kind": "announcement",
         "payload": {"message": "정원 규칙 설정에서 시듦 기준일을 바꿀 수 있어요.", "from_admin": True},
         "created_at": _at(6), "acked_at": _at(5)},
    ]).execute()

    _ai_log(db, uid, 0.2, "이번 주에 챙겨야 할 거 정리해줘",
            "이번 주 정원 상황을 정리했어요.",
            [{"name": "list_buds", "args": {"deadline_within_days": 7}, "ok": True,
              "message": "봉우리 4개", "data": {}},
             {"name": "list_calendar_events", "args": {"from": _day(0), "to": _day(7)}, "ok": True,
              "message": "일정 3개", "data": {}}])
    _ai_log(db, uid, 0.3, "포트폴리오 회고 글까지 다 써서 90%까지 왔어",
            "포트폴리오 사이트 리뉴얼 진행률을 90%로 올렸어요.",
            [{"name": "update_bud_progress", "args": {"bud_id": portfolio, "progress": 90}, "ok": True,
              "message": "진행률 90%", "data": {}}])
    _ai_log(db, uid, 1.2, "모레 오후 2시에 치과 검진 일정 넣어줘. 파란색으로",
            "치과 정기검진 일정을 추가했어요.",
            [{"name": "create_calendar_event",
              "args": {"title": "치과 정기검진", "date": _day(2), "time": "14:00", "color": "파랑"},
              "ok": True, "message": "일정 생성", "data": {}}])


def _seed_extra_user(db: Client, username: str, nickname: str, plants: list[tuple[str, list[tuple[str, str, int]]]],
                     days_ago: int) -> None:
    # Sample members for the admin screens. Random passwords: not meant for login.
    uid = _create_user(db, username, secrets.token_urlsafe(16), nickname, days_ago=days_ago)
    for name, buds in plants:
        pid = _plant(db, uid, name, "", days_ago)
        for title, status, progress in buds:
            _bud(db, uid, pid, title, status=status, progress=progress,
                 created_days_ago=days_ago - 1, last_days_ago=2)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    db = get_client()
    if db.table("users").select("id").eq("username", "demo").limit(1).execute().data:
        logger.info("Seed skipped: demo user already exists.")
        return

    demo = _create_user(db, "demo", "demo1234", "데모 정원사", email="demo@example.com", days_ago=45)
    _create_user(db, "admin", "admin1234", "관리자", role="admin", email="admin@example.com", days_ago=60)
    _seed_demo(db, demo)
    _seed_extra_user(db, "minji", "민지", [
        ("운동", [("필라테스 주 2회", "flower", 60), ("스쿼트 100개 챌린지", "bud", 30)]),
        ("독서", [("한 달에 책 2권", "fruit", 85)]),
    ], days_ago=20)
    _seed_extra_user(db, "junho", "준호", [
        ("이직 준비", [("이력서 업데이트", "harvested", 100), ("B사 과제 전형", "bud", 45)]),
    ], days_ago=12)

    from app.services.garden_state_service import GardenStateService
    GardenStateService(db).refresh_summary(demo)
    logger.info("Seed complete: demo/demo1234, admin/admin1234")


if __name__ == "__main__":
    main()
