"use client";

import type { ReactNode } from "react";

import { flattenCalendarDays, useWorshipContext } from "@/components/worship/use-worship-context";
import type { WorshipStatus } from "@/lib/types";

export type WorshipShellContext = ReturnType<typeof useWorshipContext>;

type WorshipWorkspaceShellProps = {
  context: WorshipShellContext;
  title: string;
  description: string;
  children: ReactNode;
};

const statusTheme: Record<WorshipStatus, string> = {
  complete: "bg-emerald-100 text-emerald-800",
  progress: "bg-teal-100 text-teal-800",
  waiting: "bg-amber-100 text-amber-800",
  review: "bg-violet-100 text-violet-800",
};

const statusLabel: Record<WorshipStatus, string> = {
  complete: "입력 완료",
  progress: "입력 중",
  waiting: "대기",
  review: "검수 필요",
};

export function WorshipWorkspaceShell({
  context,
  title,
  description,
  children,
}: WorshipWorkspaceShellProps) {
  const flattened = flattenCalendarDays(context.calendar?.days);

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section className="panel-strong overflow-hidden rounded-[32px] px-6 py-6 md:px-8 md:py-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-700">
                Worship Workspace
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-slate-900">
                {title}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
                {description}
              </p>
            </div>
            {context.service ? (
              <div className="rounded-[24px] border border-slate-200 bg-white/80 px-5 py-4 text-sm text-slate-700">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  현재 서비스
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {context.service.serviceName}
                </p>
                <p className="mt-1">
                  {context.activeDay?.dateLabel} ({context.activeDay?.weekdayLabel}) /{" "}
                  {new Date(context.service.startAt).toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <span
                  className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTheme[context.service.status]}`}
                >
                  {statusLabel[context.service.status]}
                </span>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                날짜
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {context.calendar?.days.map((day) => (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => context.setAnchorDate(day.date)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      context.anchorDate === day.date
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {day.date.slice(5)} / {day.weekdayLabel}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                예배
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {flattened.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => context.setServiceId(service.id)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      context.serviceId === service.id
                        ? "bg-emerald-700 text-white"
                        : "border border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {service.serviceName}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {context.message ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {context.message}
        </div>
      ) : null}

      {context.isLoading ? (
        <div className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-5 text-sm text-slate-700">
          예배 데이터를 불러오는 중입니다.
        </div>
      ) : null}

      {!context.isLoading && context.service ? children : null}
    </section>
  );
}

export function getWorshipStatusLabel(status: WorshipStatus) {
  return statusLabel[status];
}

export function getWorshipStatusTheme(status: WorshipStatus) {
  return statusTheme[status];
}
