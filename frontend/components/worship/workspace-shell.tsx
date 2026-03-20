"use client";

import { useMemo, type ReactNode } from "react";

import { useWorshipContext } from "@/components/worship/use-worship-context";
import type { WorshipCalendarDay, WorshipStatus } from "@/lib/types";

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
  complete: "예배 완료",
  progress: "예배 중",
  waiting: "대기",
  review: "검토 필요",
};

function parseLocalDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

function endOfWeek(date: Date) {
  const next = new Date(date);
  next.setDate(next.getDate() + (6 - next.getDay()));
  return next;
}

function formatMonthLabel(dateKey: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
  }).format(parseLocalDate(dateKey));
}

function formatDayLabel(dateKey: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
  }).format(parseLocalDate(dateKey));
}

function formatWeekdayLabel(dateKey: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    weekday: "short",
  }).format(parseLocalDate(dateKey));
}

function formatServiceTime(startAt: string) {
  return new Date(startAt).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shiftMonth(dateKey: string, offset: number) {
  const date = parseLocalDate(dateKey);
  return toDateKey(new Date(date.getFullYear(), date.getMonth() + offset, 16));
}

function buildCalendarCells(
  viewDateKey: string,
  selectedDateKey: string | null,
  days: WorshipCalendarDay[],
) {
  const dayMap = new Map(days.map((day) => [day.date, day]));
  const selectedDate = parseLocalDate(viewDateKey);
  const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);

  const cells: Array<{
    dateKey: string;
    isCurrentMonth: boolean;
    isSelected: boolean;
    day: WorshipCalendarDay | null;
  }> = [];

  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const dateKey = toDateKey(cursor);
    cells.push({
      dateKey,
      isCurrentMonth: cursor.getMonth() === selectedDate.getMonth(),
      isSelected: dateKey === selectedDateKey,
      day: dayMap.get(dateKey) ?? null,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return cells;
}

function CalendarPanel({
  context,
  viewDateKey,
  selectedDateKey,
  compact,
}: {
  context: WorshipShellContext;
  viewDateKey: string | null;
  selectedDateKey: string | null;
  compact: boolean;
}) {
  const calendarDays = context.calendar?.days ?? [];
  const calendarCells = useMemo(() => {
    if (!viewDateKey) {
      return [];
    }
    return buildCalendarCells(viewDateKey, selectedDateKey, calendarDays);
  }, [calendarDays, selectedDateKey, viewDateKey]);

  if (!viewDateKey) {
    return (
      <article className="rounded-[24px] border border-slate-200 bg-white/80 p-5">
        <p className="text-sm text-slate-500">달력을 불러오는 중입니다.</p>
      </article>
    );
  }

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">달력</p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900">
          {formatMonthLabel(viewDateKey)}
        </h2>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => context.setAnchorDate(shiftMonth(viewDateKey, -1))}
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          이전 달
        </button>
        <button
          type="button"
          onClick={() => context.setAnchorDate(shiftMonth(viewDateKey, 1))}
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          다음 달
        </button>
      </div>
    </div>
  );

  const grid = (
    <>
      <div className="mt-5 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {["일", "월", "화", "수", "목", "금", "토"].map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-7 gap-2">
        {calendarCells.map((cell) => {
          const serviceCount = cell.day?.services.length ?? 0;
          const hasServices = Boolean(cell.day);

          return (
            <button
              key={cell.dateKey}
              type="button"
              onClick={() => {
                if (hasServices) {
                  context.setAnchorDate(cell.dateKey);
                }
              }}
              className={`min-h-[44px] rounded-[20px] border px-2 py-2 text-left transition ${
                cell.isSelected
                  ? "border-emerald-500 bg-emerald-50 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]"
                  : hasServices
                    ? "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    : "border-dashed border-slate-200 bg-slate-50 text-slate-300"
              } ${cell.isCurrentMonth ? "text-slate-900" : "text-slate-400"}`}
              disabled={!hasServices}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold">{parseLocalDate(cell.dateKey).getDate()}</span>
                {serviceCount > 0 ? (
                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                    {serviceCount}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );

  if (compact) {
    return (
      <details className="rounded-[24px] border border-slate-200 bg-white/80 p-5 md:hidden">
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">달력</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {selectedDateKey ? formatDayLabel(selectedDateKey) : "날짜를 선택하세요"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {context.selectedDayServices.length}개 · 탭해서 펼치기
              </p>
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
              열기
            </div>
          </div>
        </summary>
        {header}
        {grid}
      </details>
    );
  }

  return (
    <article className="hidden rounded-[24px] border border-slate-200 bg-white/80 p-5 md:block">
      {header}
      {grid}
    </article>
  );
}

export function WorshipWorkspaceShell({
  context,
  title,
  description,
  children,
}: WorshipWorkspaceShellProps) {
  const viewDateKey = context.calendar?.anchorDate ?? context.anchorDate ?? context.selectedDay?.date ?? null;
  const selectedDateKey = context.selectedDay?.date ?? viewDateKey;

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
              <div className="hidden rounded-[24px] border border-slate-200 bg-white/80 px-5 py-4 text-sm text-slate-700 md:block">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  현재 선택
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {context.service.serviceName}
                </p>
                <p className="mt-1">
                  {context.selectedDay?.dateLabel ?? context.service.date} (
                  {context.selectedDay?.weekdayLabel ?? formatWeekdayLabel(context.service.date)}) /{" "}
                  {formatServiceTime(context.service.startAt)}
                </p>
                <span
                  className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTheme[context.service.status]}`}
                >
                  {statusLabel[context.service.status]}
                </span>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-4">
              <CalendarPanel
                context={context}
                viewDateKey={viewDateKey}
                selectedDateKey={selectedDateKey}
                compact={true}
              />
              <CalendarPanel
                context={context}
                viewDateKey={viewDateKey}
                selectedDateKey={selectedDateKey}
                compact={false}
              />
            </div>

            <article className="rounded-[24px] border border-slate-200 bg-white/80 p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    예배 목록
                  </p>
                </div>
                <p className="text-sm text-slate-500">{context.selectedDayServices.length}개</p>
              </div>

              <div className="mt-5 grid gap-3">
                {context.selectedDayServices.length > 0 ? (
                  context.selectedDayServices.map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => context.setServiceId(service.id)}
                      className={`rounded-[22px] border px-4 py-4 text-left transition ${
                        context.serviceId === service.id
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{service.serviceName}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {service.serviceKind} · {formatServiceTime(service.startAt)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTheme[service.status]}`}
                        >
                          {statusLabel[service.status]}
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">
                        섹션 {service.reviewSummary.totalSections}개 · 진행 {service.reviewSummary.progressSections}개 · 검토 {service.reviewSummary.reviewSections}개
                      </p>
                    </button>
                  ))
                ) : (
                  <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                    선택한 날짜에 예배가 없습니다.
                  </div>
                )}
              </div>
            </article>
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
