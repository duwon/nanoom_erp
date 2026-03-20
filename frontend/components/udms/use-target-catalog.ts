"use client";

import { useEffect, useMemo, useState } from "react";

import { getTargetTypes } from "@/lib/api";
import type { TargetTypeDescriptor } from "@/lib/types";

export function buildTargetDeepLink(target: TargetTypeDescriptor | null | undefined, targetId: string) {
  if (!target) {
    return null;
  }
  return target.deepLinkTemplate.replace("{target_id}", encodeURIComponent(targetId));
}

export function useTargetCatalog() {
  const [catalog, setCatalog] = useState<TargetTypeDescriptor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      try {
        const items = await getTargetTypes();
        if (!active) {
          return;
        }
        setCatalog(items);
        setMessage("");
      } catch (error) {
        if (!active) {
          return;
        }
        setMessage(error instanceof Error ? error.message : "Failed to load target catalog.");
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
  }, []);

  function getTargetDescriptor(targetType: string) {
    return catalog.find((item) => item.targetType === targetType) ?? null;
  }

  const enabledTargets = useMemo(() => catalog.filter((item) => item.isEnabled), [catalog]);

  return {
    catalog,
    enabledTargets,
    getTargetDescriptor,
    isLoading,
    message,
  };
}
