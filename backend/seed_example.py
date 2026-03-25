"""
예배 모듈 예제 데이터 시드 스크립트.

실행 방법 (backend 디렉토리에서):
    python seed_example.py
    python seed_example.py --mongo-url mongodb://localhost:27017 --date 2026-03-29

환경변수 MONGO_URL 또는 .env 파일도 인식합니다.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from motor.motor_asyncio import AsyncIOMotorClient

# backend/app 패키지를 import 가능하게 경로 설정
sys.path.insert(0, os.path.dirname(__file__))

from app.core.store import iso_now, new_id
from app.modules.worship.repository import (
    MongoWorshipRepository,
    default_section_type_definitions,
    default_worship_templates,
)
from app.modules.worship.schemas import WorshipServiceStatus

TIMEZONE = ZoneInfo("Asia/Seoul")


# ---------------------------------------------------------------------------
# 예배 순서 예제 데이터 (주일오전예배 기준)
# 첨부된 예배 순서지를 기준으로 작성
# ---------------------------------------------------------------------------

def _section(section_id: str, order: int, type_code: str, bucket: str, **kw) -> dict:
    return {
        "id": section_id,
        "order": order,
        "section_type_code": type_code,
        "workspace_bucket": bucket,
        "title": kw.get("title", ""),
        "detail": kw.get("detail", ""),
        "role": kw.get("role", ""),
        "assignee_id": None,
        "assignee_name": kw.get("assignee_name"),
        "status": WorshipServiceStatus.waiting.value,
        "duration_minutes": kw.get("duration_minutes", 5),
        "due_offset_minutes": kw.get("due_offset_minutes", 120),
        "input_template_id": kw.get("input_template_id", ""),
        "slide_template_key": kw.get("slide_template_key", ""),
        "notes": kw.get("notes", ""),
        "content": {},
        "slides": [],
        "updated_at": iso_now(),
    }


def _task(section: dict, input_template: dict | None, start_dt: datetime) -> dict | None:
    if not input_template:
        return None
    due_offset = section.get("due_offset_minutes", 120)
    return {
        "id": f"task-{section['id']}",
        "section_id": section["id"],
        "input_template_id": section["input_template_id"],
        "role": section.get("role", ""),
        "scope": section.get("title", ""),
        "required_fields": input_template.get("fields", []),
        "status": WorshipServiceStatus.waiting.value,
        "due_at": (start_dt - timedelta(minutes=int(due_offset))).isoformat(),
        "tips": input_template.get("tips", ""),
        "guest_access": {
            "token_hash": None,
            "issued_at": None,
            "expires_at": None,
            "revoked_at": None,
            "last_opened_at": None,
        },
        "last_submitted_at": None,
        "values": {},
    }


def build_sunday1_sections() -> list[dict]:
    """주일 1부 예배 순서 (09:00) - 2026-03-29 예배 순서지 기준."""
    return [
        _section("s1-call",        1,  "call_to_worship", "content", title="예배로 부름",  detail="이사야 53:5-6",        role="인도자",       input_template_id="input-call-to-worship",  slide_template_key="scripture-main", duration_minutes=3,  due_offset_minutes=120),
        _section("s1-confession",  2,  "confession",       "content", title="신앙고백",     detail="사도신경",             role="다함께",       input_template_id="",                       slide_template_key="prayer-card",    duration_minutes=2,  due_offset_minutes=120),
        _section("s1-antiphonal",  3,  "antiphonal",       "content", title="성경교독",     detail="시편 40:1-5",          role="한절씩 교독",  input_template_id="input-antiphonal",       slide_template_key="scripture-main", duration_minutes=3,  due_offset_minutes=120),
        _section("s1-praise",      4,  "song",             "music",   title="경배와찬양",   notes="찬송가 86장 풀은 마르고 / 주님 말씀하시면",  role="찬양팀",   input_template_id="input-song-lyrics",      slide_template_key="lyrics-16x9",    duration_minutes=10, due_offset_minutes=180),
        _section("s1-prayer",      5,  "prayer",           "content", title="회중기도",     role="인도자",       assignee_name="신미연 권사",  input_template_id="input-prayer",            slide_template_key="prayer-card",    duration_minutes=5,  due_offset_minutes=90),
        _section("s1-scripture",   6,  "scripture",        "content", title="성경봉독",     detail="요한복음 19:26-27",    role="인도자",       input_template_id="input-scripture",        slide_template_key="scripture-main", duration_minutes=4,  due_offset_minutes=120),
        _section("s1-special-song",7,  "special_song",     "music",   title="찬양",         notes="주달려 죽은 십자가",    role="찬양팀",       assignee_name="아셀",                        input_template_id="input-special-song", slide_template_key="lyrics-16x9", duration_minutes=5, due_offset_minutes=150),
        _section("s1-message",     8,  "message",          "content", title="십자가로 돌아오다", role="설교자",    assignee_name="백종규 목사",  input_template_id="input-message-notes",     slide_template_key="message-notes",  duration_minutes=25, due_offset_minutes=120),
        _section("s1-notice",      9,  "notice",           "content", title="교회소식",     role="인도자",       input_template_id="input-notice",           slide_template_key="notice-card",    duration_minutes=4,  due_offset_minutes=90),
        _section("s1-hymn",        10, "song",             "music",   title="찬송",         notes="어린 양이 되게 하소서",  role="찬양팀",      assignee_name="변창진 집사",                  input_template_id="input-song-lyrics", slide_template_key="lyrics-16x9", duration_minutes=4, due_offset_minutes=180),
        _section("s1-offering",    11, "offering",         "content", title="헌금봉헌",     role="다함께",       input_template_id="",                       slide_template_key="notice-card",    duration_minutes=4,  due_offset_minutes=90),
        _section("s1-hymn2",       12, "song",             "music",   title="찬송",         notes="우리가 교회입니다 후렴",  role="다함께",      input_template_id="input-song-lyrics",      slide_template_key="lyrics-16x9",    duration_minutes=2,  due_offset_minutes=180),
        _section("s1-benediction", 13, "benediction",      "content", title="축도",         role="담임목사",     assignee_name="백종규 목사",  input_template_id="",                       slide_template_key="prayer-card",    duration_minutes=2,  due_offset_minutes=60),
    ]


def build_sunday2_sections() -> list[dict]:
    """주일 2부 예배 순서 (11:00) - 2026-03-29 예배 순서지 기준."""
    return [
        _section("s2-call",        1,  "call_to_worship", "content", title="예배로 부름",  detail="이사야 53:5-6",        role="인도자",       input_template_id="input-call-to-worship",  slide_template_key="scripture-main", duration_minutes=3,  due_offset_minutes=120),
        _section("s2-confession",  2,  "confession",       "content", title="신앙고백",     detail="사도신경",             role="다함께",       input_template_id="",                       slide_template_key="prayer-card",    duration_minutes=2,  due_offset_minutes=120),
        _section("s2-antiphonal",  3,  "antiphonal",       "content", title="성경교독",     detail="시편 40:1-5",          role="한절씩 교독",  input_template_id="input-antiphonal",       slide_template_key="scripture-main", duration_minutes=3,  due_offset_minutes=120),
        _section("s2-praise",      4,  "song",             "music",   title="경배와찬양",   notes="찬송가 86장 풀은 마르고 / 주님 말씀하시면",  role="찬양팀",   input_template_id="input-song-lyrics",      slide_template_key="lyrics-16x9",    duration_minutes=10, due_offset_minutes=180),
        _section("s2-prayer",      5,  "prayer",           "content", title="회중기도",     role="인도자",       assignee_name="최종범 안수집사",  input_template_id="input-prayer",           slide_template_key="prayer-card",    duration_minutes=5,  due_offset_minutes=90),
        _section("s2-scripture",   6,  "scripture",        "content", title="성경봉독",     detail="요한복음 19:26-27",    role="인도자",       input_template_id="input-scripture",        slide_template_key="scripture-main", duration_minutes=4,  due_offset_minutes=120),
        _section("s2-special-song",7,  "special_song",     "music",   title="찬양",         notes="거기 네 있었는가",      role="찬양팀",       assignee_name="주사랑",                      input_template_id="input-special-song", slide_template_key="lyrics-16x9", duration_minutes=5, due_offset_minutes=150),
        _section("s2-message",     8,  "message",          "content", title="십자가로 돌아오다", role="설교자",    assignee_name="백종규 목사",  input_template_id="input-message-notes",     slide_template_key="message-notes",  duration_minutes=25, due_offset_minutes=120),
        _section("s2-notice",      9,  "notice",           "content", title="교회소식",     role="인도자",       input_template_id="input-notice",           slide_template_key="notice-card",    duration_minutes=4,  due_offset_minutes=90),
        _section("s2-hymn",        10, "song",             "music",   title="찬송",         notes="어린 양이 되게 하소서",  role="찬양팀",      assignee_name="변창진 집사",                  input_template_id="input-song-lyrics", slide_template_key="lyrics-16x9", duration_minutes=4, due_offset_minutes=180),
        _section("s2-offering",    11, "offering",         "content", title="헌금봉헌",     role="다함께",       input_template_id="",                       slide_template_key="notice-card",    duration_minutes=4,  due_offset_minutes=90),
        _section("s2-hymn2",       12, "song",             "music",   title="찬송",         notes="우리가 교회입니다 후렴",  role="다함께",      input_template_id="input-song-lyrics",      slide_template_key="lyrics-16x9",    duration_minutes=2,  due_offset_minutes=180),
        _section("s2-benediction", 13, "benediction",      "content", title="축도",         role="담임목사",     assignee_name="백종규 목사",  input_template_id="",                       slide_template_key="prayer-card",    duration_minutes=2,  due_offset_minutes=60),
    ]


def build_service_doc(
    service_id: str,
    target_date: date,
    service_kind: str,
    service_name: str,
    start_time: str,
    template_id: str,
    sections: list[dict],
    input_templates: dict[str, dict],
) -> dict:
    now = iso_now()
    hour, minute = [int(p) for p in start_time.split(":")]
    start_dt = datetime.combine(target_date, time(hour=hour, minute=minute), tzinfo=TIMEZONE)
    start_at = start_dt.isoformat()

    tasks = []
    for section in sections:
        input_tmpl = input_templates.get(section["input_template_id"])
        t = _task(section, input_tmpl, start_dt)
        if t:
            tasks.append(t)

    status_counts = {s.value: 0 for s in WorshipServiceStatus}
    for sec in sections:
        status_counts[sec["status"]] += 1

    return {
        "id": service_id,
        "date": target_date.isoformat(),
        "service_kind": service_kind,
        "service_name": service_name,
        "start_at": start_at,
        "summary": "",
        "template_id": template_id,
        "version": 1,
        "status": WorshipServiceStatus.waiting.value,
        "sections": sections,
        "tasks": tasks,
        "task_guest_access": {f"task-{s['id']}": {} for s in sections if s["input_template_id"]},
        "review_summary": {
            "total_sections": len(sections),
            "complete_sections": status_counts[WorshipServiceStatus.complete.value],
            "progress_sections": status_counts[WorshipServiceStatus.progress.value],
            "waiting_sections": status_counts[WorshipServiceStatus.waiting.value],
            "review_sections": status_counts[WorshipServiceStatus.review.value],
            "pending_review_count": status_counts[WorshipServiceStatus.waiting.value]
                + status_counts[WorshipServiceStatus.progress.value]
                + status_counts[WorshipServiceStatus.review.value],
            "pending_task_count": sum(
                1 for t in tasks if t["status"] != WorshipServiceStatus.complete.value
            ),
        },
        "export_snapshot": {},
        "created_at": now,
        "updated_at": now,
    }


async def run(mongo_url: str, mongo_db: str, target_date: date) -> None:
    print(f"[seed] MongoDB: {mongo_url}/{mongo_db}")
    print(f"[seed] 예제 예배 날짜: {target_date.isoformat()} ({target_date.strftime('%A')})")

    client = AsyncIOMotorClient(mongo_url)
    db = client[mongo_db]
    repo = MongoWorshipRepository(db)

    # 1) 인덱스 생성
    await repo.ensure_indexes()

    # 2) admin 스키마 버전 삭제 → 강제 재시드
    print("[seed] 관리자 스키마 초기화 중...")
    await db["worship_config"].delete_many({})
    await repo.seed_defaults_if_empty()
    print("[seed] 관리자 데이터 시드 완료")

    # 3) 기존 서비스 삭제
    deleted = await db["worship_services"].delete_many({})
    print(f"[seed] 기존 서비스 {deleted.deleted_count}개 삭제")

    # 4) input 템플릿 로드 (task 필드 구성용)
    input_templates = {
        item["id"]: item
        for item in await repo.list_input_templates(active_only=False)
    }
    print(f"[seed] 입력 템플릿 {len(input_templates)}개 로드됨")

    # 5) 예제 서비스 생성
    services = [
        build_service_doc(
            service_id=f"svc-{target_date.isoformat()}-sunday1",
            target_date=target_date,
            service_kind="sunday1",
            service_name="주일 1부 예배",
            start_time="09:00",
            template_id="wtemplate-sunday1",
            sections=build_sunday1_sections(),
            input_templates=input_templates,
        ),
        build_service_doc(
            service_id=f"svc-{target_date.isoformat()}-sunday2",
            target_date=target_date,
            service_kind="sunday2",
            service_name="주일 2부 예배",
            start_time="11:00",
            template_id="wtemplate-sunday2",
            sections=build_sunday2_sections(),
            input_templates=input_templates,
        ),
    ]

    await db["worship_services"].insert_many(services)
    print(f"[seed] 예배 서비스 {len(services)}개 생성 완료")
    for svc in services:
        sec_count = len(svc["sections"])
        task_count = len(svc["tasks"])
        print(f"       - {svc['service_name']} ({svc['start_at'][:16]}) | 섹션 {sec_count}개, 태스크 {task_count}개")

    # 6) presentation_state 초기화
    await db["presentation_state"].delete_many({})
    await repo.seed_defaults_if_empty()
    print("[seed] 완료!")

    client.close()


def next_sunday(from_date: date | None = None) -> date:
    d = from_date or date.today()
    # weekday(): 0=Mon, 6=Sun
    days_until_sunday = (6 - d.weekday()) % 7
    if days_until_sunday == 0:
        return d
    return d + timedelta(days=days_until_sunday)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Worship 모듈 예제 데이터 시드")
    parser.add_argument("--mongo-url", default=os.getenv("MONGO_URL", "mongodb://localhost:27017"))
    parser.add_argument("--mongo-db", default=os.getenv("MONGO_DB", "nanoom_erp"))
    parser.add_argument(
        "--date",
        default=None,
        help="예배 날짜 (YYYY-MM-DD). 기본값: 이번 주 일요일",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    if args.date:
        target = date.fromisoformat(args.date)
    else:
        target = next_sunday()
    asyncio.run(run(args.mongo_url, args.mongo_db, target))
