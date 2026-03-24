"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getBoards, listDocuments } from "@/lib/api";
import type { Board, DocumentStatus, DocumentSummary, DocumentTargetType } from "@/lib/types";
import { useTargetCatalog } from "@/components/udms/use-target-catalog";

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

export default function UdmsDocumentsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [targetType, setTargetType] = useState<DocumentTargetType | "">("");
  const [targetId, setTargetId] = useState("");
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "">("");
  const [query, setQuery] = useState("");
  const [myDocuments, setMyDocuments] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { enabledTargets, message: catalogMessage } = useTargetCatalog();

  async function loadDocuments(
    nextTargetType = targetType,
    nextTargetId = targetId,
    nextStatus = statusFilter,
    nextQuery = query,
    nextMyDocuments = myDocuments,
  ) {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await listDocuments({
        targetType: nextTargetType || undefined,
        targetId: nextTargetId || undefined,
        status: nextStatus || undefined,
        q: nextQuery || undefined,
        myDocuments: nextMyDocuments || undefined,
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

      await loadDocuments("", "", "", "", false);
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
    <div className="flex flex-col gap-4">
      <section className="panel rounded-[28px] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void loadDocuments(targetType, targetId, statusFilter, query); }}
            placeholder="제목·요약·태그 검색"
            className="min-w-0 flex-1 rounded-[20px] border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-amber-400"
          />

          <select
            value={targetType}
            onChange={(event) => {
              const nextType = event.target.value as DocumentTargetType | "";
              setTargetType(nextType);
              setTargetId(nextType === "Board" ? boards[0]?.id ?? "" : "");
            }}
            className="rounded-[20px] border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-amber-400"
          >
            <option value="">전체 대상</option>
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
              className="rounded-[20px] border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-amber-400"
            >
              <option value="">전체 게시판</option>
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          ) : null}

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as DocumentStatus | "")}
            className="rounded-[20px] border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-amber-400"
          >
            <option value="">전체 상태</option>
            <option value="draft">초안</option>
            <option value="published">게시됨</option>
            <option value="locked">잠김</option>
            <option value="archived">보관됨</option>
          </select>

          <button
            type="button"
            onClick={() => void loadDocuments(targetType, targetId, statusFilter, query, myDocuments)}
            className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            검색
          </button>

          <button
            type="button"
            onClick={() => {
              const next = !myDocuments;
              setMyDocuments(next);
              void loadDocuments(targetType, targetId, statusFilter, query, next);
            }}
            className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${myDocuments ? "border-amber-400 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-600"}`}
          >
            내 글만
          </button>

          <div className="ml-auto flex gap-2">
            <Link href="/udms/shares" className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700">
              공유 목록
            </Link>
            <Link href="/udms/documents/new" className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">
              새 문서
            </Link>
          </div>
        </div>
      </section>

      {message || catalogMessage ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {message || catalogMessage}
        </div>
      ) : null}

      <section className="panel overflow-hidden rounded-[28px]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="w-10 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">제목</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 sm:table-cell">대상</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">상태</th>
                <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 md:table-cell">버전</th>
                <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 lg:table-cell">수정일</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">불러오는 중...</td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">문서가 없습니다.</td>
                </tr>
              ) : (
                documents.map((document, index) => (
                  <tr key={document.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-amber-50/60">
                    <td className="px-4 py-3 text-center text-xs text-slate-400">{index + 1}</td>
                    <td className="px-4 py-3">
                      <Link href={`/udms/documents/${document.id}`} className="block">
                        <span className="font-medium text-slate-900 hover:text-amber-700">{document.header.title}</span>
                        {document.currentRevision.summary ? (
                          <span className="ml-2 text-xs text-slate-400">{document.currentRevision.summary}</span>
                        ) : null}
                        {document.header.tags.length > 0 ? (
                          <span className="ml-2 text-xs text-slate-400">[{document.header.tags.join(", ")}]</span>
                        ) : null}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <span className="text-xs text-slate-500">{document.link.targetType}</span>
                      {document.link.targetId ? (
                        <span className="ml-1 text-xs text-slate-400">/ {document.link.targetId}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[document.state.status]}`}>
                        {statusLabels[document.state.status]}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-center text-xs text-slate-500 md:table-cell">
                      v{document.currentRevision.version}
                    </td>
                    <td className="hidden px-4 py-3 text-right text-xs text-slate-400 lg:table-cell">
                      {formatDate(document.metadata.updatedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
