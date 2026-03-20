"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { getWorshipCalendar, getWorshipService } from "@/lib/api";
import type {
  WorshipCalendarDay,
  WorshipCalendarResponse,
  WorshipCalendarService,
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

function normalizeCalendarAnchorDate(anchorDate: string | null) {
  const today = anchorDate
    ? (() => {
        const [year, month, day] = anchorDate.split("-").map(Number);
        return new Date(year, month - 1, day);
      })()
    : new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-16`;
}

export function useWorshipContext(days = 42) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [calendar, setCalendar] = useState<WorshipCalendarResponse | null>(null);
  const [service, setService] = useState<WorshipServiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  const anchorDate = searchParams.get("anchorDate");
  const serviceId = searchParams.get("serviceId");

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setMessage("");
      try {
        const nextCalendar = await getWorshipCalendar({
          anchorDate: normalizeCalendarAnchorDate(anchorDate),
          days,
        });
        if (!active) {
          return;
        }
        setCalendar(nextCalendar);

        const selectedDay = findSelectedDay(nextCalendar.days, anchorDate, serviceId);
        const serviceOptions = nextCalendar.days.flatMap((day) => day.services);
        const hasRequestedService = serviceId
          ? serviceOptions.some((candidate) => candidate.id === serviceId)
          : false;
        const resolvedServiceId =
          (serviceId && hasRequestedService ? serviceId : null) ??
          selectedDay?.services[0]?.id ??
          null;
        const resolvedAnchorDate = selectedDay?.date ?? nextCalendar.anchorDate;

        if (
          resolvedAnchorDate !== anchorDate ||
          (resolvedServiceId !== serviceId && resolvedServiceId !== null)
        ) {
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
  }, [anchorDate, days, pathname, router, searchParams, serviceId]);

  const serviceMap = useMemo(() => {
    const map = new Map<string, WorshipCalendarService>();
    for (const day of calendar?.days ?? []) {
      for (const candidate of day.services) {
        map.set(candidate.id, candidate);
      }
    }
    return map;
  }, [calendar]);

  const selectedDay = useMemo(
    () => findSelectedDay(calendar?.days ?? [], anchorDate, serviceId),
    [anchorDate, calendar, serviceId],
  );
  const selectedDayServices = selectedDay?.services ?? [];
  const selectedServiceSummary = service ? serviceMap.get(service.id) ?? null : null;

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

  return {
    calendar,
    service,
    selectedServiceSummary,
    selectedDay,
    selectedDayServices,
    isLoading,
    message,
    anchorDate: anchorDate ?? calendar?.anchorDate ?? null,
    serviceId: service?.id ?? serviceId,
    setAnchorDate,
    setServiceId,
    setService,
    refreshService,
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
