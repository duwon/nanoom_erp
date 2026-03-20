"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getSharedDocuments } from "@/lib/api";
import type { SharedDocumentOverview } from "@/lib/types";
import { ModulePage } from "@/components/module-page";

export default function UdmsSharesPage() {
  const [overview, setOverview] = useState<SharedDocumentOverview>({ received: [], sent: [] });
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setOverview(await getSharedDocuments());
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "공유 목록을 불러오지 못했습니다.");
      }
    }
    void load();
  }, []);

  return (
    <ModulePage
      eyebrow="문서 관리 / 공유"
      title="문서 공유"
      description="내가 공유한 문서와 공유받은 문서를 교차로 확인합니다."
      highlights={[
        `공유받은 문서 ${overview.received.length}건`,
        `내가 공유한 문서 ${overview.sent.length}건`,
        "새 버전 생성 시 share 자동 복제",
      ]}
      actions={[{ href: "/udms/documents", label: "문서 목록", variant: "secondary" }]}
    >
      {message ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {message}
        </div>
      ) : null}

      <section className="panel rounded-[28px] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Received</p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900">공유받은 문서</h2>
        <div className="mt-4 grid gap-3">
          {overview.received.map((item) => (
            <Link key={`${item.direction}-${item.share.id}`} href={`/udms/documents/${item.document.id}`} className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
              {item.document.title} / {item.share.permission} / {item.share.targetType}:{item.share.targetId}
            </Link>
          ))}
        </div>
      </section>

      <section className="panel rounded-[28px] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Sent</p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900">내가 공유한 문서</h2>
        <div className="mt-4 grid gap-3">
          {overview.sent.map((item) => (
            <Link key={`${item.direction}-${item.share.id}`} href={`/udms/documents/${item.document.id}`} className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
              {item.document.title} / {item.share.permission} / {item.share.targetType}:{item.share.targetId}
            </Link>
          ))}
        </div>
      </section>
    </ModulePage>
  );
}
