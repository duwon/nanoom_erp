"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  buildWorshipHref,
  buildWorshipSectionEditorHref,
  findNewSiblingSection,
} from "@/components/worship/navigation";
import { useWorshipContext } from "@/components/worship/use-worship-context";
import { WorshipWorkspaceShell, getWorshipStatusLabel, getWorshipStatusTheme } from "@/components/worship/workspace-shell";
import { addWorshipSection } from "@/lib/api";

export default function WorshipHomePage() {
  const router = useRouter();
  const context = useWorshipContext();
  const service = context.service;
  const summary = service?.reviewSummary;
  const [actionMessage, setActionMessage] = useState("");
  const [addingAfterSectionId, setAddingAfterSectionId] = useState<string | null>(null);

  return (
    <WorshipWorkspaceShell
      context={context}
      title="예배 운영 대시보드"
      description="날짜별 예배 순서를 확인하고, 각 섹션의 진행 상태와 바로가기 작업을 한 화면에서 관리합니다."
    >
      {service && summary ? (
        <section className="grid gap-4">
          <section className="panel rounded-[24px] px-4 py-3">
            <div className="flex flex-wrap gap-3 text-sm text-slate-600">
              <span>전체 {summary.totalSections}</span>
              <span>대기 {summary.waitingSections}</span>
              <span>입력 중 {summary.progressSections}</span>
              <span>입력 완료 {summary.reviewSections}</span>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <article className="panel rounded-[24px] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">예배 순서</p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-900">{service.serviceName}</h2>
                </div>
                <Link
                  href={buildWorshipHref("/worship/review", context.anchorDate, context.serviceId)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                >
                  검토 화면
                </Link>
              </div>

              {actionMessage ? (
                <div className="mt-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {actionMessage}
                </div>
              ) : null}

              <div className="mt-4 grid gap-2">
                {service.sections.map((section) => (
                  <div key={section.id} className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {section.order}. {section.sectionType}
                        </p>
                        <h3 className="mt-1 truncate text-base font-semibold text-slate-900">{section.title}</h3>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                          {section.detail || section.notes || "추가 내용 없음"}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getWorshipStatusTheme(section.status)}`}>
                          {getWorshipStatusLabel(section.status)}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                          {section.assigneeName || section.role || "담당 미정"}
                        </span>
                        {section.capabilities.canAddSiblingSong ? (
                          <button
                            type="button"
                            disabled={addingAfterSectionId === section.id}
                            onClick={async () => {
                              setAddingAfterSectionId(section.id);
                              setActionMessage("");
                              try {
                                const nextService = await addWorshipSection(service.id, {
                                  version: service.version,
                                  afterSectionId: section.id,
                                  sectionType: "song",
                                });
                                context.setService(nextService);
                                const nextSection = findNewSiblingSection(nextService, section.id, "song");
                                if (!nextSection) {
                                  setActionMessage("찬양을 추가했지만 새 편집 화면으로 이동하지 못했습니다.");
                                  return;
                                }
                                router.push(
                                  buildWorshipSectionEditorHref(nextSection.id, context.anchorDate, nextService.id),
                                );
                              } catch (error) {
                                setActionMessage(error instanceof Error ? error.message : "찬양 추가에 실패했습니다.");
                              } finally {
                                setAddingAfterSectionId(null);
                              }
                            }}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            {addingAfterSectionId === section.id ? "추가 중.." : "찬양 추가"}
                          </button>
                        ) : null}
                        {section.capabilities.canEdit ? (
                          <Link
                            href={buildWorshipSectionEditorHref(section.id, context.anchorDate, context.serviceId)}
                            className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            편집
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <section className="grid gap-4">
              <article className="panel rounded-[24px] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">빠른 이동</p>
                <div className="mt-3 grid gap-2">
                  {[
                    { href: "/worship/assignees", label: "작업 배정" },
                    { href: "/worship/songs", label: "찬양 / 특송" },
                    { href: "/worship/message", label: "성경 / 말씀" },
                    { href: "/worship/review", label: "출력 / 검토" },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={buildWorshipHref(item.href, context.anchorDate, context.serviceId)}
                      className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </article>

              <article className="panel rounded-[24px] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">바로 수정할 수 있는 섹션</p>
                <div className="mt-3 grid gap-2">
                  {service.sections.filter((section) => section.capabilities.canEdit).length ? (
                    service.sections
                      .filter((section) => section.capabilities.canEdit)
                      .map((section) => (
                        <Link
                          key={section.id}
                          href={buildWorshipSectionEditorHref(section.id, context.anchorDate, context.serviceId)}
                          className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700"
                        >
                          {section.order}. {section.title}
                        </Link>
                      ))
                  ) : (
                    <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                      현재 직접 편집 가능한 섹션이 없습니다.
                    </div>
                  )}
                </div>
              </article>
            </section>
          </section>
        </section>
      ) : null}
    </WorshipWorkspaceShell>
  );
}
