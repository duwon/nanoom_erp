"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { createWorshipService, getCurrentUser, getWorshipCalendar, getWorshipService } from "@/lib/api";
import type {
  AuthUser,
  WorshipCalendarDay,
  WorshipCalendarResponse,
  WorshipCalendarService,
  WorshipCalendarTemplateOption,
  WorshipServiceDetail,
} from "@/lib/types";

function buildQueryString(params: URLSearchParams, patch: Record<string, string | null | undefined>) {
  const next = new URLSearchParams(params.toString());
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === "") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }
  return next.toString();
}

function findSelectedDay(days: WorshipCalendarDay[], anchorDate: string | null, serviceId: string | null) {
  if (anchorDate) {
    const matched = days.find((day) => day.date === anchorDate);
    if (matched) {
      return matched;
    }
  }

  if (serviceId) {
    const matched = days.find((day) => day.services.some((service) => service.id === serviceId));
    if (matched) {
      return matched;
    }
  }

  return days.find((day) => day.services.length > 0) ?? days[0] ?? null;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeCalendarAnchorDate(anchorDate: string | null) {
  return anchorDate || toDateKey(new Date());
}

export function useWorshipContext(days = 42) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [calendar, setCalendar] = useState<WorshipCalendarResponse | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [service, setService] = useState<WorshipServiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  const anchorDate = searchParams.get("anchorDate");
  const serviceId = searchParams.get("serviceId");
  const requestedAnchorDate = normalizeCalendarAnchorDate(anchorDate);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setMessage("");
      try {
        const user = await getCurrentUser();
        if (!active) {
          return;
        }
        setCurrentUser(user);
        const nextCalendar = await getWorshipCalendar({
          anchorDate: requestedAnchorDate,
          days,
        });
        if (!active) {
          return;
        }
        setCalendar(nextCalendar);

        const selectedDay = findSelectedDay(
          nextCalendar.days,
          anchorDate ?? (serviceId ? null : requestedAnchorDate),
          serviceId,
        );
        const serviceOptions = nextCalendar.days.flatMap((day) => day.services);
        const hasRequestedService = serviceId
          ? serviceOptions.some((candidate) => candidate.id === serviceId)
          : false;
        const resolvedServiceId =
          (serviceId && hasRequestedService ? serviceId : null) ??
          selectedDay?.services[0]?.id ??
          null;
        const resolvedAnchorDate =
          anchorDate ??
          (serviceId ? selectedDay?.date ?? requestedAnchorDate : requestedAnchorDate);

        if (resolvedAnchorDate !== anchorDate || resolvedServiceId !== serviceId) {
          const query = buildQueryString(searchParams, {
            anchorDate: resolvedAnchorDate,
            serviceId: resolvedServiceId,
          });
          router.replace(`${pathname}?${query}`, { scroll: false });
        }

        if (!resolvedServiceId) {
          setService(null);
          return;
        }

        const nextService = await getWorshipService(resolvedServiceId);
        if (!active) {
          return;
        }
        setService(nextService);
      } catch (error) {
        if (!active) {
          return;
        }
        setMessage(error instanceof Error ? error.message : "예배 데이터를 불러오지 못했습니다.");
        setCurrentUser(null);
        setService(null);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [anchorDate, days, pathname, requestedAnchorDate, router, searchParams, serviceId]);

  const serviceMap = useMemo(() => {
    const map = new Map<string, WorshipCalendarService>();
    for (const day of calendar?.days ?? []) {
      for (const candidate of day.services) {
        map.set(candidate.id, candidate);
      }
    }
    return map;
  }, [calendar]);

  const effectiveAnchorDate = anchorDate ?? (serviceId ? null : calendar?.anchorDate ?? null);
  const selectedDay = useMemo(
    () => findSelectedDay(calendar?.days ?? [], effectiveAnchorDate, serviceId),
    [calendar, effectiveAnchorDate, serviceId],
  );
  const selectedDayServices = selectedDay?.services ?? [];
  const selectedDayAvailableTemplates = selectedDay?.availableTemplates ?? [];
  const selectedServiceSummary = service ? serviceMap.get(service.id) ?? null : null;
  const resolvedContextAnchorDate =
    anchorDate ??
    effectiveAnchorDate ??
    (serviceId ? selectedDay?.date ?? calendar?.anchorDate ?? null : calendar?.anchorDate ?? null);

  function setAnchorDate(nextAnchorDate: string) {
    const nextDay = calendar?.days.find((day) => day.date === nextAnchorDate) ?? null;
    const nextServiceId =
      nextDay?.services.find((candidate) => candidate.id === serviceId)?.id ??
      nextDay?.services[0]?.id ??
      null;
    const query = buildQueryString(searchParams, {
      anchorDate: nextAnchorDate,
      serviceId: nextServiceId,
    });
    router.replace(`${pathname}?${query}`, { scroll: false });
  }

  function setServiceId(nextServiceId: string) {
    const query = buildQueryString(searchParams, {
      anchorDate: selectedDay?.date ?? anchorDate ?? calendar?.anchorDate ?? null,
      serviceId: nextServiceId,
    });
    router.replace(`${pathname}?${query}`, { scroll: false });
  }

  async function refreshService(targetServiceId?: string) {
    const resolvedServiceId = targetServiceId ?? service?.id;
    if (!resolvedServiceId) {
      return;
    }
    const nextService = await getWorshipService(resolvedServiceId);
    setService(nextService);
  }

  async function createServiceForDate(template: WorshipCalendarTemplateOption, targetDate?: string) {
    const resolvedTargetDate = targetDate ?? selectedDay?.date ?? anchorDate ?? calendar?.anchorDate;
    if (!resolvedTargetDate) {
      throw new Error("예배를 추가할 날짜를 먼저 선택해 주세요.");
    }
    const created = await createWorshipService({
      targetDate: resolvedTargetDate,
      templateId: template.templateId,
    });
    const query = buildQueryString(searchParams, {
      anchorDate: created.date,
      serviceId: created.id,
    });
    router.replace(`${pathname}?${query}`, { scroll: false });
    return created;
  }

  return {
    calendar,
    currentUser,
    service,
    selectedServiceSummary,
    selectedDay,
    selectedDayServices,
    selectedDayAvailableTemplates,
    isLoading,
    message,
    anchorDate: resolvedContextAnchorDate,
    serviceId: service?.id ?? serviceId,
    setAnchorDate,
    setServiceId,
    setService,
    refreshService,
    createServiceForDate,
  };
}

export function flattenCalendarDays(days: WorshipCalendarDay[] | undefined) {
  return (days ?? []).flatMap((day) =>
    day.services.map((service) => ({
      ...service,
      date: day.date,
      weekdayLabel: day.weekdayLabel,
      dateLabel: day.dateLabel,
    })),
  );
}
