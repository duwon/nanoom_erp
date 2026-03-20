"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { listDocuments } from "@/lib/api";
import type { DocumentSummary, DocumentTargetType } from "@/lib/types";
import { buildTargetDeepLink, useTargetCatalog } from "@/components/udms/use-target-catalog";

type DocumentContainerProps = {
  targetType: DocumentTargetType;
  targetId: string;
  title: string;
};

export function DocumentContainer({ targetType, targetId, title }: DocumentContainerProps) {
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
    <section className="panel rounded-[28px] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
        {displayLabel} / {targetId || "all"}
      </p>
      <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900">{title}</h2>
      {targetLink ? (
        <Link href={targetLink} className="mt-2 inline-flex text-sm font-medium text-amber-700 underline-offset-4 hover:underline">
          Open target context
        </Link>
      ) : null}

      {message || catalogMessage ? <p className="mt-3 text-sm text-rose-700">{message || catalogMessage}</p> : null}

      <div className="mt-4 grid gap-3">
        {documents.length ? (
          documents.map((document) => (
            <Link
              key={document.id}
              href={`/udms/documents/${document.id}`}
              className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700"
            >
              <p className="font-semibold text-slate-900">{document.header.title}</p>
              <p className="mt-1 text-slate-600">
                {document.state.status} / v{document.currentRevision.version}
              </p>
            </Link>
          ))
        ) : (
          <div className="rounded-[20px] border border-dashed border-slate-300 bg-white/70 px-4 py-4 text-sm text-slate-600">
            No documents are linked to this target yet.
          </div>
        )}
      </div>
    </section>
  );
}
