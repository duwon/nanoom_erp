"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getBoards } from "@/lib/api";
import type { Board } from "@/lib/types";
import { DocumentContainer } from "@/components/udms/document-container";

export default function UdmsBoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const boardItems = await getBoards();
        setBoards(boardItems);
        setSelectedBoardId(boardItems[0]?.id ?? "");
        setMessage("");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "게시판 목록을 불러오지 못했습니다.");
      }
    }

    void load();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <section className="panel rounded-[28px] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedBoardId}
            onChange={(event) => setSelectedBoardId(event.target.value)}
            className="rounded-[20px] border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-amber-400"
          >
            <option value="">게시판 선택</option>
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>

          <div className="ml-auto flex gap-2">
            <Link
              href="/udms/documents"
              className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
            >
              전체 문서
            </Link>
            <Link
              href="/udms/documents/new"
              className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
            >
              새 문서
            </Link>
          </div>
        </div>
      </section>

      {message ? (
        <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {message}
        </div>
      ) : null}

      <DocumentContainer targetType="Board" targetId={selectedBoardId} />
    </div>
  );
}
