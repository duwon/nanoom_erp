"""
Worship 모듈 예제 서비스 데이터 빌더.

앱 시작 시 이번 주 주일 예배 서비스를 자동으로 생성합니다.
주일오전예배 순서지(1부 09:00, 2부 11:00)를 기반으로 합니다.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from app.core.store import iso_now
from app.modules.worship.schemas import WorshipServiceStatus


def _section(
    section_id: str,
    order: int,
    type_code: str,
    bucket: str,
    *,
    title: str,
    detail: str = "",
    role: str = "",
    assignee_name: str | None = None,
    notes: str = "",
    input_template_id: str = "",
    slide_template_key: str = "",
    duration_minutes: int = 5,
    due_offset_minutes: int = 120,
) -> dict[str, Any]:
    return {
        "id": section_id,
        "order": order,
        "section_type_code": type_code,
        "workspace_bucket": bucket,
        "title": title,
        "detail": detail,
        "role": role,
        "assignee_id": None,
        "assignee_name": assignee_name,
        "status": WorshipServiceStatus.waiting.value,
        "duration_minutes": duration_minutes,
        "due_offset_minutes": due_offset_minutes,
        "input_template_id": input_template_id,
        "slide_template_key": slide_template_key,
        "notes": notes,
        "content": {},
        "slides": [],
        "updated_at": iso_now(),
    }


def _make_task(section: dict[str, Any], input_template: dict[str, Any], start_dt: datetime) -> dict[str, Any]:
    due_offset = int(section.get("due_offset_minutes", 120))
    return {
        "id": f"task-{section['id']}",
        "section_id": section["id"],
        "input_template_id": section["input_template_id"],
        "role": section.get("role", ""),
        "scope": section.get("title", ""),
        "required_fields": input_template.get("fields", []),
        "status": WorshipServiceStatus.waiting.value,
        "due_at": (start_dt - timedelta(minutes=due_offset)).isoformat(),
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


def _sunday1_sections() -> list[dict[str, Any]]:
    """주일 1부 예배 섹션 (09:00) — 주일오전예배 순서지 기준."""
    return [
        _section("s1-call",         1,  "call_to_worship", "content", title="예배로 부름",          detail="이사야 53:5-6",          role="인도자",            input_template_id="input-call-to-worship", slide_template_key="scripture-main", duration_minutes=3,  due_offset_minutes=120),
        _section("s1-confession",   2,  "confession",       "content", title="신앙고백",             detail="사도신경",               role="다함께",            input_template_id="",                      slide_template_key="prayer-card",    duration_minutes=2,  due_offset_minutes=120),
        _section("s1-antiphonal",   3,  "antiphonal",       "content", title="성경교독",             detail="시편 40:1-5",            role="한절씩 교독",       input_template_id="input-antiphonal",      slide_template_key="scripture-main", duration_minutes=3,  due_offset_minutes=120),
        _section("s1-praise",       4,  "song",             "music",   title="경배와찬양",           notes="찬송가 86장 풀은 마르고 / 주님 말씀하시면", role="찬양팀", input_template_id="input-song-lyrics",  slide_template_key="lyrics-16x9",    duration_minutes=10, due_offset_minutes=180),
        _section("s1-prayer",       5,  "prayer",           "content", title="회중기도",             role="인도자",           assignee_name="신미연 권사",   input_template_id="input-prayer",          slide_template_key="prayer-card",    duration_minutes=5,  due_offset_minutes=90),
        _section("s1-scripture",    6,  "scripture",        "content", title="성경봉독",             detail="요한복음 19:26-27",      role="인도자",            input_template_id="input-scripture",       slide_template_key="scripture-main", duration_minutes=4,  due_offset_minutes=120),
        _section("s1-special-song", 7,  "special_song",     "music",   title="찬양",                notes="주달려 죽은 십자가",      role="찬양팀",   assignee_name="아셀",    input_template_id="input-special-song",    slide_template_key="lyrics-16x9",    duration_minutes=5,  due_offset_minutes=150),
        _section("s1-message",      8,  "message",          "content", title="십자가로 돌아오다",    role="설교자",           assignee_name="백종규 목사",   input_template_id="input-message-notes",   slide_template_key="message-notes",  duration_minutes=25, due_offset_minutes=120),
        _section("s1-notice",       9,  "notice",           "content", title="교회소식",             role="인도자",                                            input_template_id="input-notice",          slide_template_key="notice-card",    duration_minutes=4,  due_offset_minutes=90),
        _section("s1-hymn",         10, "song",             "music",   title="찬송",                notes="어린 양이 되게 하소서",   role="찬양팀",   assignee_name="변창진 집사", input_template_id="input-song-lyrics", slide_template_key="lyrics-16x9",    duration_minutes=4,  due_offset_minutes=180),
        _section("s1-offering",     11, "offering",         "content", title="헌금봉헌",             role="다함께",                                            input_template_id="",                      slide_template_key="notice-card",    duration_minutes=4,  due_offset_minutes=90),
        _section("s1-hymn2",        12, "song",             "music",   title="찬송",                notes="우리가 교회입니다 후렴",  role="다함께",                                              input_template_id="input-song-lyrics", slide_template_key="lyrics-16x9",  duration_minutes=2,  due_offset_minutes=180),
        _section("s1-benediction",  13, "benediction",      "content", title="축도",                role="담임목사",          assignee_name="백종규 목사",   input_template_id="",                      slide_template_key="prayer-card",    duration_minutes=2,  due_offset_minutes=60),
    ]


def _sunday2_sections() -> list[dict[str, Any]]:
    """주일 2부 예배 섹션 (11:00) — 주일오전예배 순서지 기준."""
    return [
        _section("s2-call",         1,  "call_to_worship", "content", title="예배로 부름",          detail="이사야 53:5-6",          role="인도자",                  input_template_id="input-call-to-worship", slide_template_key="scripture-main", duration_minutes=3,  due_offset_minutes=120),
        _section("s2-confession",   2,  "confession",       "content", title="신앙고백",             detail="사도신경",               role="다함께",                  input_template_id="",                      slide_template_key="prayer-card",    duration_minutes=2,  due_offset_minutes=120),
        _section("s2-antiphonal",   3,  "antiphonal",       "content", title="성경교독",             detail="시편 40:1-5",            role="한절씩 교독",             input_template_id="input-antiphonal",      slide_template_key="scripture-main", duration_minutes=3,  due_offset_minutes=120),
        _section("s2-praise",       4,  "song",             "music",   title="경배와찬양",           notes="찬송가 86장 풀은 마르고 / 주님 말씀하시면", role="찬양팀",  input_template_id="input-song-lyrics",  slide_template_key="lyrics-16x9",    duration_minutes=10, due_offset_minutes=180),
        _section("s2-prayer",       5,  "prayer",           "content", title="회중기도",             role="인도자",     assignee_name="최종범 안수집사",           input_template_id="input-prayer",          slide_template_key="prayer-card",    duration_minutes=5,  due_offset_minutes=90),
        _section("s2-scripture",    6,  "scripture",        "content", title="성경봉독",             detail="요한복음 19:26-27",      role="인도자",                  input_template_id="input-scripture",       slide_template_key="scripture-main", duration_minutes=4,  due_offset_minutes=120),
        _section("s2-special-song", 7,  "special_song",     "music",   title="찬양",                notes="거기 네 있었는가",        role="찬양팀",  assignee_name="주사랑", input_template_id="input-special-song",    slide_template_key="lyrics-16x9",    duration_minutes=5,  due_offset_minutes=150),
        _section("s2-message",      8,  "message",          "content", title="십자가로 돌아오다",    role="설교자",     assignee_name="백종규 목사",               input_template_id="input-message-notes",   slide_template_key="message-notes",  duration_minutes=25, due_offset_minutes=120),
        _section("s2-notice",       9,  "notice",           "content", title="교회소식",             role="인도자",                                              input_template_id="input-notice",          slide_template_key="notice-card",    duration_minutes=4,  due_offset_minutes=90),
        _section("s2-hymn",         10, "song",             "music",   title="찬송",                notes="어린 양이 되게 하소서",   role="찬양팀",  assignee_name="변창진 집사", input_template_id="input-song-lyrics", slide_template_key="lyrics-16x9",    duration_minutes=4,  due_offset_minutes=180),
        _section("s2-offering",     11, "offering",         "content", title="헌금봉헌",             role="다함께",                                              input_template_id="",                      slide_template_key="notice-card",    duration_minutes=4,  due_offset_minutes=90),
        _section("s2-hymn2",        12, "song",             "music",   title="찬송",                notes="우리가 교회입니다 후렴",  role="다함께",                  input_template_id="input-song-lyrics",     slide_template_key="lyrics-16x9",    duration_minutes=2,  due_offset_minutes=180),
        _section("s2-benediction",  13, "benediction",      "content", title="축도",                role="담임목사",   assignee_name="백종규 목사",               input_template_id="",                      slide_template_key="prayer-card",    duration_minutes=2,  due_offset_minutes=60),
    ]


def _build_service(
    target_date: date,
    service_kind: str,
    template_id: str,
    template: dict[str, Any],
    sections: list[dict[str, Any]],
    input_templates: dict[str, dict[str, Any]],
    tz: ZoneInfo,
) -> dict[str, Any]:
    now = iso_now()
    start_time: str = template.get("start_time", "09:00")
    hour, minute = (int(p) for p in start_time.split(":"))
    start_dt = datetime.combine(target_date, time(hour=hour, minute=minute), tzinfo=tz)

    tasks: list[dict[str, Any]] = []
    for sec in sections:
        tmpl = input_templates.get(sec["input_template_id"])
        if tmpl:
            tasks.append(_make_task(sec, tmpl, start_dt))

    status_counts = {s.value: 0 for s in WorshipServiceStatus}
    for sec in sections:
        status_counts[sec["status"]] += 1

    return {
        "id": f"svc-{target_date.isoformat()}-{service_kind}",
        "date": target_date.isoformat(),
        "service_kind": service_kind,
        "service_name": template.get("display_name", "예배"),
        "start_at": start_dt.isoformat(),
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
            "pending_review_count": (
                status_counts[WorshipServiceStatus.waiting.value]
                + status_counts[WorshipServiceStatus.progress.value]
                + status_counts[WorshipServiceStatus.review.value]
            ),
            "pending_task_count": len(tasks),
        },
        "export_snapshot": {},
        "created_at": now,
        "updated_at": now,
    }


def build_sunday_services(
    target_date: date,
    templates: dict[str, dict[str, Any]],
    input_templates: dict[str, dict[str, Any]],
    tz: ZoneInfo,
) -> list[dict[str, Any]]:
    """이번 주 주일 1부, 2부 예배 서비스 도큐먼트를 반환합니다."""
    services = []
    pairs = [
        ("wtemplate-sunday1", "sunday1", _sunday1_sections),
        ("wtemplate-sunday2", "sunday2", _sunday2_sections),
    ]
    for template_id, service_kind, sections_fn in pairs:
        template = templates.get(template_id)
        if template is None:
            continue
        services.append(
            _build_service(
                target_date=target_date,
                service_kind=service_kind,
                template_id=template_id,
                template=template,
                sections=sections_fn(),
                input_templates=input_templates,
                tz=tz,
            )
        )
    return services
