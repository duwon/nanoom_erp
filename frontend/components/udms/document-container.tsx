"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { listDocuments } from "@/lib/api";
import type { DocumentStatus, DocumentSummary, DocumentTargetType } from "@/lib/types";
import { buildTargetDeepLink, useTargetCatalog } from "@/components/udms/use-target-catalog";

const statusLabels: Record<DocumentStatus, string> = {
  draft: "초안",
  published: "게시됨",
  locked: "잠김",
  archived: "보관됨",
};

const statusStyles: Record<DocumentStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  published: "bg-green-100 text-green-700",
  locked: "bg-amber-100 text-amber-700",
  archived: "bg-rose-100 text-rose-700",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

type DocumentContainerProps = {
  targetType: DocumentTargetType;
  targetId: string;
};

export function DocumentContainer({ targetType, targetId }: DocumentContainerProps) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [message, setMessage] = useState("");
  const { getTargetDescriptor, message: catalogMessage } = useTargetCatalog();
  const descriptor = getTargetDescriptor(targetType);
  const displayLabel = descriptor?.label ?? targetType;
  const targetLink = targetId ? buildTargetDeepLink(descriptor, targetId) : null;

  useEffect(() => {
    async function load() {
      try {
        setDocuments(
          await listDocuments({
            targetType,
            targetId: targetId || undefined,
          }),
        );
        setMessage("");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to load documents.");
      }
    }

    void load();
  }, [targetId, targetType]);

  return (
    <section className="panel overflow-hidden rounded-[28px]">
      {message || catalogMessage ? (
        <p className="px-4 py-3 text-sm text-rose-700">{message || catalogMessage}</p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="w-8 px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">#</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">제목</th>
              <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">상태</th>
              <th className="hidden px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 sm:table-cell">버전</th>
              <th className="hidden px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 md:table-cell">수정일</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-xs text-slate-400">
                  연결된 문서가 없습니다.
                </td>
              </tr>
            ) : (
              documents.map((document, index) => (
                <tr key={document.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-amber-50/60">
                  <td className="px-3 py-2.5 text-center text-xs text-slate-400">{index + 1}</td>
                  <td className="px-3 py-2.5">
                    <Link href={`/udms/documents/${document.id}`} className="font-medium text-slate-900 hover:text-amber-700">
                      {document.header.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[document.state.status]}`}>
                      {statusLabels[document.state.status]}
                    </span>
                  </td>
                  <td className="hidden px-3 py-2.5 text-center text-xs text-slate-500 sm:table-cell">
                    v{document.currentRevision.version}
                  </td>
                  <td className="hidden px-3 py-2.5 text-right text-xs text-slate-400 md:table-cell">
                    {formatDate(document.metadata.updatedAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

