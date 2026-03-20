"use client";

import { useEffect, useState } from "react";

import { getBoards } from "@/lib/api";
import type { Board } from "@/lib/types";
import { ModulePage } from "@/components/module-page";
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
        setMessage(error instanceof Error ? error.message : "Failed to load boards.");
      }
    }

    void load();
  }, []);

  return (
    <ModulePage
      eyebrow="UDMS / Board"
      title="Board Context"
      description="Board-linked documents now use the same document engine as every other target type. Board policy is managed through target policies."
      highlights={[
        `${boards.length} boards available`,
        "Board is a targetType, not a separate document model",
        "Document lists stay on /udms/documents while this page stays context-bound",
      ]}
      actions={[
        { href: "/udms/documents", label: "All Documents", variant: "secondary" },
        { href: "/admin/boards", label: "Board Admin", variant: "secondary" },
      ]}
    >
      {message ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {message}
        </div>
      ) : null}

      <section className="panel rounded-[28px] p-5">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Board</span>
          <select
            value={selectedBoardId}
            onChange={(event) => setSelectedBoardId(event.target.value)}
            className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
          >
            <option value="">Select a board</option>
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <DocumentContainer targetType="Board" targetId={selectedBoardId} title="Board Documents" />
    </ModulePage>
  );
}
