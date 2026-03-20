"use client";

import Link from "next/link";

import { useWorshipContext } from "@/components/worship/use-worship-context";
import { WorshipWorkspaceShell, getWorshipStatusLabel, getWorshipStatusTheme } from "@/components/worship/workspace-shell";

function buildHref(path: string, anchorDate: string | null, serviceId: string | null) {
  const params = new URLSearchParams();
  if (anchorDate) {
    params.set("anchorDate", anchorDate);
  }
  if (serviceId) {
    params.set("serviceId", serviceId);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function buildTaskEditorHref(
  task: { sectionIds: string[] },
  anchorDate: string | null,
  serviceId: string | null,
  service?: { sections: Array<{ id: string; sectionType: string }> },
) {
  const section = service?.sections.find((candidate) => task.sectionIds.includes(candidate.id));
  const path =
    section?.sectionType === "song" || section?.sectionType === "special_song"
      ? "/worship/songs"
      : section?.sectionType === "scripture" || section?.sectionType === "message" || section?.sectionType === "notice"
        ? "/worship/message"
        : "/worship/assignees";
  return buildHref(path, anchorDate, serviceId);
}

export default function WorshipHomePage() {
  const context = useWorshipContext();
  const service = context.service;
  const summary = service?.reviewSummary;

  return (
    <WorshipWorkspaceShell
      context={context}
      title="예배 운영 대시보드"
      description="날짜를 선택해서 해당 예배의 순서와 담당자 진행 상태를 확인합니다."
    >
      {service && summary ? (
        <>
          <section className="grid grid-cols-4 gap-2 md:gap-4">
            {[
              { label: "전체 순서", value: summary.totalSections },
              { label: "완료", value: summary.completeSections },
              { label: "검수 필요", value: summary.reviewSections },
              { label: "남은 업무", value: summary.pendingTaskCount },
            ].map((card) => (
              <article key={card.label} className="panel rounded-[24px] p-3 sm:p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:text-xs sm:tracking-[0.28em]">
                  {card.label}
                </p>
                <p className="mt-2 font-display text-2xl font-semibold text-slate-900 sm:mt-4 sm:text-4xl">
                  {card.value}
                </p>
              </article>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <article className="panel rounded-[28px] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                    타임라인
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900">
                    예배 순서
                  </h2>
                </div>
                <Link
                  href={buildHref("/worship/review", context.anchorDate, context.serviceId)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                >
                  검토 화면
                </Link>
              </div>

              <div className="mt-5 grid gap-3">
                {service.sections.map((section) => (
                  <div
                    key={section.id}
                    className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                          {section.order}. {section.sectionType}
                        </p>
                        <h3 className="mt-2 text-lg font-semibold text-slate-900">
                          {section.title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {section.detail || section.notes || "내용 없음"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getWorshipStatusTheme(section.status)}`}
                        >
                          {getWorshipStatusLabel(section.status)}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                          {section.role || "역할 미지정"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <div className="grid gap-6">
              <article className="panel rounded-[28px] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  담당자 진행
                </p>
                <div className="mt-4 grid gap-3">
                  {service.tasks.map((task) => (
                    <div key={task.id} className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{task.role}</p>
                          <p className="mt-1 text-sm text-slate-600">{task.scope}</p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getWorshipStatusTheme(task.status)}`}
                        >
                          {getWorshipStatusLabel(task.status)}
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">
                        마감: {task.dueAt ? new Date(task.dueAt).toLocaleString("ko-KR") : "미설정"}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          href={buildHref("/worship/assignees", context.anchorDate, context.serviceId)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                        >
                          담당자 입력
                        </Link>
                        <Link
                          href={buildTaskEditorHref(task, context.anchorDate, context.serviceId, service)}
                          className="rounded-full border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                        >
                          편집
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="panel rounded-[28px] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  빠른 이동
                </p>
                <div className="mt-4 grid gap-3">
                  {[
                    { href: "/worship/assignees", label: "담당자 입력함" },
                    { href: "/worship/songs", label: "찬양 / 특송" },
                    { href: "/worship/message", label: "성경 / 말씀" },
                    { href: "/worship/review", label: "출력 / 검토" },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={buildHref(item.href, context.anchorDate, context.serviceId)}
                      className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm font-medium text-slate-700"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </article>
            </div>
          </section>
        </>
      ) : null}
    </WorshipWorkspaceShell>
  );
}
