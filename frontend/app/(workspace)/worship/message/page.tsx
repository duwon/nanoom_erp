"use client";

import { WorshipWorkQueue } from "@/components/worship/work-queue";
import { useWorshipContext } from "@/components/worship/use-worship-context";

export default function WorshipMessagePage() {
  const context = useWorshipContext();

  return (
    <WorshipWorkQueue
      context={context}
      title="본문 / 메시지 입력"
      description="콘텐츠 버킷 순서를 모아 본문, 기도문, 공지, 메시지를 같은 큐에서 관리합니다."
      workspaceBucket="content"
    />
  );
}
