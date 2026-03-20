"use client";

import { WorshipWorkQueue } from "@/components/worship/work-queue";
import { useWorshipContext } from "@/components/worship/use-worship-context";

export default function WorshipAssigneesPage() {
  const context = useWorshipContext();

  return (
    <WorshipWorkQueue
      context={context}
      title="담당자 입력함"
      description="내가 편집 가능한 예배 순서를 모아 보고, 바로 편집하거나 공유 링크를 발급합니다."
    />
  );
}
