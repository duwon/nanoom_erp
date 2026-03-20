"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getBoards, listUdmsDocuments } from "@/lib/api";
import type { Board, DocumentStatus, UdmsDocumentSummary } from "@/lib/types";
import { ModulePage } from "@/components/module-page";

const statusLabels: Record<DocumentStatus, string> = {
  draft: "초안",
  published: "게시",
  superseded: "이전 버전",
};

export default function UdmsDocumentsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [documents, setDocuments] = useState<UdmsDocumentSummary[]>([]);
  const [boardId, setBoardId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function loadDocuments(nextBoardId = boardId, nextStatus = statusFilter, nextQuery = query) {
    setIsLoading(true);
    setMessage("");
    try {
      const response = await listUdmsDocuments({
        boardId: nextBoardId || undefined,
        status: nextStatus || undefined,
        q: nextQuery || undefined,
      });
      setDocuments(response);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "문서 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const boardItems = await getBoards();
        setBoards(boardItems);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "게시판 정보를 불러오지 못했습니다.");
      }
      await loadDocuments("", "", "");
    }
    void load();
  }, []);

  const boardMap = useMemo(() => Object.fromEntries(boards.map((board) => [board.id, board.name])), [boards]);

  return (
    <ModulePage
      eyebrow="문서 관리 / 문서"
      title="문서"
      description="문서 목록에서 현재 버전, 상태, 보드, 결재 템플릿 연결 여부를 함께 확인합니다."
      highlights={[
        `${documents.length}건 문서`,
        "게시와 새 버전 생성 흐름",
        "공유와 첨부는 상세 화면에서 관리",
      ]}
      actions={[
        { href: "/udms/documents/new", label: "새 문서", variant: "primary" },
        { href: "/udms/shares", label: "공유", variant: "secondary" },
      ]}
    >
      <section className="panel rounded-[28px] p-5">
        <div className="grid gap-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="제목 또는 본문 검색"
            className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={boardId}
              onChange={(event) => setBoardId(event.target.value)}
              className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
            >
              <option value="">전체 게시판</option>
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
            >
              <option value="">전체 상태</option>
              <option value="draft">초안</option>
              <option value="published">게시</option>
              <option value="superseded">이전 버전</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => void loadDocuments(boardId, statusFilter, query)}
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
          >
            필터 적용
          </button>
        </div>
      </section>

      {message ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {message}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4 text-sm text-slate-700">
          문서 목록을 불러오는 중입니다.
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
                {boardMap[document.boardId] ?? document.boardId}
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900">
                {document.title}
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                상태 {statusLabels[document.status]} / 버전 {document.versionNumber}
              </p>
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
              {document.approvalTemplateId ? "템플릿 연결" : "템플릿 없음"}
            </div>
          </div>
        </Link>
      ))}
    </ModulePage>
  );
}
