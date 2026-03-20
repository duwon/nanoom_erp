"use client";

import { WorshipWorkQueue } from "@/components/worship/work-queue";
import { useWorshipContext } from "@/components/worship/use-worship-context";

export default function WorshipMessagePage() {
  const context = useWorshipContext();

  return (
    <WorshipWorkQueue
      context={context}
      title="성경 / 말씀 입력"
      description="본문, 말씀, 공지, 미디어 순서를 같은 작업 큐에서 필터링해 편집합니다."
      sectionTypes={["scripture", "message", "notice", "media"]}
    />
  );
}
