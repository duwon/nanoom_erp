"use client";

import type { WorshipSectionType, WorshipServiceDetail } from "@/lib/types";

export function buildWorshipHref(
  path: string,
  anchorDate: string | null,
  serviceId: string | null,
  extra?: Record<string, string | null | undefined>,
) {
  const params = new URLSearchParams();
  if (anchorDate) {
    params.set("anchorDate", anchorDate);
  }
  if (serviceId) {
    params.set("serviceId", serviceId);
  }
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function buildWorshipSectionEditorHref(
  sectionId: string,
  anchorDate: string | null,
  serviceId: string | null,
) {
  return buildWorshipHref(`/worship/sections/${sectionId}/edit`, anchorDate, serviceId);
}

export function findNewSiblingSection(
  service: WorshipServiceDetail,
  afterSectionId: string,
  sectionType: WorshipSectionType,
) {
  const afterSection = service.sections.find((section) => section.id === afterSectionId);
  if (!afterSection) {
    return null;
  }
  return (
    service.sections.find(
      (section) => section.sectionType === sectionType && section.order === afterSection.order + 1,
    ) ?? null
  );
}
