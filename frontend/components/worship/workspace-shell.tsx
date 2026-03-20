"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

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
  complete: "출력 완료",
  progress: "입력 중",
  waiting: "대기",
  review: "입력 완료",
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

function shiftMonth(dateKey: string, offset: number) {
  const date = parseLocalDate(dateKey);
  return toDateKey(new Date(date.getFullYear(), date.getMonth() + offset, 16));
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
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(parseLocalDate(dateKey));
}

function formatWeekdayLabel(dateKey: string) {
  return new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(parseLocalDate(dateKey));
}

function formatServiceTime(startAt: string) {
  return new Date(startAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function buildCalendarCells(viewDateKey: string, selectedDateKey: string | null, days: WorshipCalendarDay[]) {
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
      isSelected: selectedDateKey === dateKey,
      day: dayMap.get(dateKey) ?? null,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return cells;
}

function CalendarContent({
  context,
  viewDateKey,
  selectedDateKey,
}: {
  context: WorshipShellContext;
  viewDateKey: string;
  selectedDateKey: string | null;
}) {
  const calendarDays = context.calendar?.days ?? [];
  const calendarCells = useMemo(
    () => buildCalendarCells(viewDateKey, selectedDateKey, calendarDays),
    [calendarDays, selectedDateKey, viewDateKey],
  );

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">달력</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">{formatMonthLabel(viewDateKey)}</h2>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => context.setAnchorDate(shiftMonth(viewDateKey, -1))}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
          >
            이전
          </button>
          <button
            type="button"
            onClick={() => context.setAnchorDate(shiftMonth(viewDateKey, 1))}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
          >
            다음
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {["일", "월", "화", "수", "목", "금", "토"].map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {calendarCells.map((cell) => {
          const serviceCount = cell.day?.services.length ?? 0;
          return (
            <button
              key={cell.dateKey}
              type="button"
              disabled={!cell.day}
              onClick={() => cell.day && context.setAnchorDate(cell.dateKey)}
              className={`min-h-[56px] rounded-[14px] border px-1.5 py-1.5 text-left transition ${
                cell.isSelected
                  ? "border-emerald-500 bg-emerald-50"
                  : cell.day
                    ? "border-slate-200 bg-white hover:border-slate-300"
                    : "border-dashed border-slate-200 bg-slate-50 text-slate-300"
              } ${cell.isCurrentMonth ? "text-slate-900" : "text-slate-400"}`}
            >
              <div className="flex h-full flex-col justify-between">
                <span className="text-sm font-semibold">{parseLocalDate(cell.dateKey).getDate()}</span>
                <span className="text-[10px] text-slate-500">{serviceCount ? `${serviceCount}건` : ""}</span>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function CalendarPanel({
  context,
  viewDateKey,
  selectedDateKey,
}: {
  context: WorshipShellContext;
  viewDateKey: string | null;
  selectedDateKey: string | null;
}) {
  if (!viewDateKey) {
    return null;
  }

  return (
    <>
      <details className="rounded-[20px] border border-slate-200 bg-white/80 p-4 md:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">달력</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{context.selectedDay?.date ?? viewDateKey}</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">
            펼치기
          </span>
        </summary>
        <div className="mt-4">
          <CalendarContent context={context} viewDateKey={viewDateKey} selectedDateKey={selectedDateKey} />
        </div>
      </details>

      <article className="hidden rounded-[20px] border border-slate-200 bg-white/80 p-4 md:block">
        <CalendarContent context={context} viewDateKey={viewDateKey} selectedDateKey={selectedDateKey} />
      </article>
    </>
  );
}

function SelectedDayActions({ context }: { context: WorshipShellContext }) {
  const [templateId, setTemplateId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const availableTemplates = context.selectedDayAvailableTemplates;

  useEffect(() => {
    setTemplateId(availableTemplates[0]?.templateId ?? "");
    setErrorMessage("");
  }, [availableTemplates]);

  if (!context.currentUser || !["master", "editor", "final_approver"].includes(context.currentUser.role)) {
    return null;
  }

  if (!context.selectedDay) {
    return null;
  }

  async function handleCreate() {
    const selectedTemplate = availableTemplates.find((item) => item.templateId === templateId);
    if (!selectedTemplate) {
      return;
    }
    setIsSubmitting(true);
    try {
      setErrorMessage("");
      await context.createServiceForDate(selectedTemplate, context.selectedDay.date);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "예배를 추가하지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-3 rounded-[16px] border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-700">선택 날짜에 예배 추가</p>
      {availableTemplates.length ? (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <select
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            className="min-w-0 flex-1 rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            {availableTemplates.map((template) => (
              <option key={template.templateId} value={template.templateId}>
                {template.displayName} ({template.startTime})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={!templateId || isSubmitting}
            className="rounded-[12px] bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting ? "추가 중.." : "예배 추가"}
          </button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">추가 가능한 예배 템플릿이 없습니다.</p>
      )}
      {errorMessage ? <p className="mt-2 text-sm text-rose-600">{errorMessage}</p> : null}
    </div>
  );
}

export function WorshipWorkspaceShell({
  context,
  title,
  description,
  children,
}: WorshipWorkspaceShellProps) {
  const viewDateKey = context.anchorDate ?? context.selectedDay?.date ?? context.calendar?.anchorDate ?? null;
  const selectedDateKey = context.selectedDay?.date ?? viewDateKey;

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      <section className="panel-strong overflow-hidden rounded-[28px] px-5 py-5 md:px-6 md:py-6">
        <div className="flex flex-col gap-4">
          <div className="hidden flex-wrap items-start justify-between gap-4 md:flex">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Worship Workspace</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">{title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
            </div>

            {context.service ? (
              <div className="rounded-[20px] border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">현재 예배</p>
                <p className="mt-1 text-base font-semibold text-slate-900">{context.service.serviceName}</p>
                <p className="mt-1">
                  {context.service.date} ({context.selectedDay?.weekdayLabel ?? formatWeekdayLabel(context.service.date)}) /{" "}
                  {formatServiceTime(context.service.startAt)}
                </p>
                <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTheme[context.service.status]}`}>
                  {statusLabel[context.service.status]}
                </span>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <CalendarPanel context={context} viewDateKey={viewDateKey} selectedDateKey={selectedDateKey} />

            <article className="rounded-[20px] border border-slate-200 bg-white/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">예배 목록</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">{context.selectedDay?.date ?? "날짜 선택"}</h2>
                </div>
                <p className="text-sm text-slate-500">{context.selectedDayServices.length}건</p>
              </div>

              <div className="mt-3 grid gap-2">
                {context.selectedDayServices.length ? (
                  context.selectedDayServices.map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => context.setServiceId(service.id)}
                      className={`rounded-[16px] border px-4 py-3 text-left transition ${
                        context.serviceId === service.id
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{service.serviceName}</p>
                          <p className="mt-1 text-sm text-slate-600">{formatServiceTime(service.startAt)}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTheme[service.status]}`}>
                          {statusLabel[service.status]}
                        </span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-[16px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    선택한 날짜에 예배가 없습니다.
                  </div>
                )}
              </div>

              <SelectedDayActions context={context} />
            </article>
          </div>
        </div>
      </section>

      {context.message ? (
        <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{context.message}</div>
      ) : null}

      {context.isLoading ? (
        <div className="rounded-[20px] border border-slate-200 bg-white/80 px-4 py-4 text-sm text-slate-700">
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
