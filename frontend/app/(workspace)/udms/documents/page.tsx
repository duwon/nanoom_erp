"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getBoards, listDocuments } from "@/lib/api";
import type { Board, DocumentStatus, DocumentSummary, DocumentTargetType } from "@/lib/types";
import { ModulePage } from "@/components/module-page";
import { useTargetCatalog } from "@/components/udms/use-target-catalog";

const statusLabels: Record<DocumentStatus, string> = {
  draft: "Draft",
  published: "Published",
  locked: "Locked",
  archived: "Archived",
};

export default function UdmsDocumentsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [targetType, setTargetType] = useState<DocumentTargetType | "">("");
  const [targetId, setTargetId] = useState("");
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "">("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { enabledTargets, message: catalogMessage } = useTargetCatalog();

  async function loadDocuments(
    nextTargetType = targetType,
    nextTargetId = targetId,
    nextStatus = statusFilter,
    nextQuery = query,
  ) {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await listDocuments({
        targetType: nextTargetType || undefined,
        targetId: nextTargetId || undefined,
        status: nextStatus || undefined,
        q: nextQuery || undefined,
      });
      setDocuments(response);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load documents.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    async function load() {
      try {
        setBoards(await getBoards());
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to load boards.");
      }

      await loadDocuments("", "", "", "");
    }

    void load();
  }, []);

  useEffect(() => {
    if (targetType && !enabledTargets.some((target) => target.targetType === targetType)) {
      setTargetType("");
      setTargetId("");
    }
  }, [enabledTargets, targetType]);

  return (
    <ModulePage
      eyebrow="UDMS / Documents"
      title="Documents"
      description="UDMS V2 lists document roots and their visible revisions by target context, document status, and query filters."
      highlights={[
        `${documents.length} documents`,
        "Published and working revisions can coexist",
        "ACL and external link counts are shown in the summary projection",
      ]}
      actions={[
        { href: "/udms/documents/new", label: "New Document", variant: "primary" },
        { href: "/udms/shares", label: "Shared View", variant: "secondary" },
      ]}
    >
      <section className="panel rounded-[28px] p-5">
        <div className="grid gap-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, summary, or tags"
            className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <select
              value={targetType}
              onChange={(event) => {
                const nextType = event.target.value as DocumentTargetType | "";
                setTargetType(nextType);
                setTargetId(nextType === "Board" ? boards[0]?.id ?? "" : "");
              }}
              className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
            >
              <option value="">All target types</option>
              {enabledTargets.map((target) => (
                <option key={target.targetType} value={target.targetType}>
                  {target.label}
                </option>
              ))}
            </select>

            {targetType === "Board" ? (
              <select
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
                className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
              >
                <option value="">All boards</option>
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
                placeholder="Target id"
                className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
              />
            )}

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as DocumentStatus | "")}
              className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="locked">Locked</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => void loadDocuments(targetType, targetId, statusFilter, query)}
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
          >
            Apply Filters
          </button>
        </div>
      </section>

      {message || catalogMessage ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {message || catalogMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4 text-sm text-slate-700">
          Loading documents...
        </div>
      ) : null}

      {documents.map((document) => (
        <Link
          key={document.id}
          href={`/udms/documents/${document.id}`}
          className="panel rounded-[28px] p-5 transition-transform duration-200 hover:-translate-y-1"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                {document.link.targetType} / {document.link.targetId}
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900">
                {document.header.title}
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {statusLabels[document.state.status]} / visible v{document.currentRevision.version} / total v{document.metadata.version}
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                ACL {document.securitySummary.aclCount} / external links {document.securitySummary.externalShareCount}
              </p>
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
              {document.currentRevision.summary || "No summary"}
            </div>
          </div>
        </Link>
      ))}
    </ModulePage>
  );
}
