"use client";

import { WorshipWorkQueue } from "@/components/worship/work-queue";
import { useWorshipContext } from "@/components/worship/use-worship-context";

export default function WorshipSongsPage() {
  const context = useWorshipContext();

  return (
    <WorshipWorkQueue
      context={context}
      title="찬양 / 특송 입력"
      description="찬양과 특송 순서만 따로 모아 빠르게 편집하고 곡을 추가하거나 공유합니다."
      sectionTypes={["song", "special_song"]}
    />
  );
}
