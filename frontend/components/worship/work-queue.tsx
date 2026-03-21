"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { issueWorshipGuestLink } from "@/lib/api";
import type { WorshipSection, WorshipStatus, WorshipWorkspaceBucket } from "@/lib/types";
import { buildWorshipSectionEditorHref } from "@/components/worship/navigation";
import { WorshipWorkspaceShell, getWorshipStatusLabel, getWorshipStatusTheme, type WorshipShellContext } from "@/components/worship/workspace-shell";

type WorkQueueProps = {
  context: WorshipShellContext;
  title: string;
  description: string;
  workspaceBucket?: WorshipWorkspaceBucket;
};

type QueueFilter = "all" | WorshipStatus | "shared";

function getTaskMeta(context: WorshipShellContext, sectionId: string) {
  const task = context.service?.tasks.find((candidate) => candidate.sectionId === sectionId) ?? null;
  return task;
}

function isVisibleSection(
  section: WorshipSection,
  showAll: boolean,
  workspaceBucket?: WorshipWorkspaceBucket,
) {
  if (workspaceBucket && section.workspaceBucket !== workspaceBucket) {
    return false;
  }
  if (showAll) {
    return true;
  }
  return section.capabilities.canEdit;
}

function queueSortRank(status: WorshipStatus) {
  if (status === "waiting") return 0;
  if (status === "progress") return 1;
  if (status === "review") return 2;
  return 3;
}

export function WorshipWorkQueue({
  context,
  title,
  description,
  workspaceBucket,
}: WorkQueueProps) {
  const service = context.service;
  const [message, setMessage] = useState("");
  const [issuingTaskId, setIssuingTaskId] = useState<string | null>(null);
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [showAll, setShowAll] = useState(false);
  const canSeeAll = context.currentUser?.role === "master";

  const items = useMemo(() => {
    if (!service) {
      return [];
    }
    return service.sections
      .filter((section) => isVisibleSection(section, showAll && canSeeAll, workspaceBucket))
      .map((section) => ({ section, task: getTaskMeta(context, section.id) }))
      .filter((item) => item.task)
      .filter((item) => {
        if (filter === "all") {
          return true;
        }
        if (filter === "shared") {
          return Boolean(item.task?.guestAccess.tokenHash);
        }
        return item.section.status === filter;
      })
      .sort((left, right) => {
        const statusDelta = queueSortRank(left.section.status) - queueSortRank(right.section.status);
        if (statusDelta !== 0) {
          return statusDelta;
        }
        return left.section.order - right.section.order;
      });
  }, [canSeeAll, context, filter, service, showAll, workspaceBucket]);

  return (
    <WorshipWorkspaceShell context={context} title={title} description={description}>
      {service ? (
        <section className="grid gap-4">
          <section className="panel rounded-[24px] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "all" as const, label: "전체" },
                  { key: "waiting" as const, label: "대기" },
                  { key: "progress" as const, label: "입력 중" },
                  { key: "review" as const, label: "입력 완료" },
                  { key: "shared" as const, label: "공유 중" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setFilter(item.key)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      filter === item.key ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {canSeeAll ? (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={showAll}
                    onChange={(event) => setShowAll(event.target.checked)}
                  />
                  전체 보기
                </label>
              ) : null}
            </div>
          </section>

          {message ? (
            <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </div>
          ) : null}

          <section className="grid gap-3">
            {items.map(({ section, task }) => (
              <article key={section.id} className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {section.order}. {section.sectionTypeCode}
                    </p>
                    <h2 className="mt-1 truncate text-base font-semibold text-slate-900">{section.title}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {section.assigneeName || section.role || "담당 미지정"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getWorshipStatusTheme(section.status)}`}>
                      {getWorshipStatusLabel(section.status)}
                    </span>
                    {task?.guestAccess.tokenHash ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        공유 중
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">
                    마감: {task?.dueAt ? new Date(task.dueAt).toLocaleString("ko-KR") : "미설정"}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {section.capabilities.canShare && task ? (
                      <button
                        type="button"
                        onClick={async () => {
                          setIssuingTaskId(task.id);
                          try {
                            const response = await issueWorshipGuestLink(service.id, task.id);
                            await navigator.clipboard.writeText(response.inputUrl);
                            await context.refreshService(service.id);
                            setMessage(`공유 링크를 복사했습니다: ${response.inputUrl}`);
                          } catch (error) {
                            setMessage(error instanceof Error ? error.message : "공유 링크 발급에 실패했습니다.");
                          } finally {
                            setIssuingTaskId(null);
                          }
                        }}
                        className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                      >
                        {issuingTaskId === task.id ? "발급 중..." : "공유 링크"}
                      </button>
                    ) : null}

                    {section.capabilities.canEdit ? (
                      <Link
                        href={buildWorshipSectionEditorHref(section.id, context.anchorDate, context.serviceId)}
                        className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                      >
                        편집
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}

            {!items.length ? (
              <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                표시할 작업이 없습니다.
              </div>
            ) : null}
          </section>
        </section>
      ) : null}
    </WorshipWorkspaceShell>
  );
}
