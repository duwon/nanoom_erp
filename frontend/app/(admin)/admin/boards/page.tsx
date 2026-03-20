"use client";

import { useEffect, useState } from "react";

import { createBoard, getBoards, updateBoard } from "@/lib/api";
import type { Board } from "@/lib/types";
import { ModulePage } from "@/components/module-page";

type DraftBoard = {
  id?: string;
  name: string;
  description: string;
  isActive: boolean;
};

const emptyDraft: DraftBoard = {
  name: "",
  description: "",
  isActive: true,
};

export default function AdminBoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [draft, setDraft] = useState<DraftBoard>(emptyDraft);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setBoards(await getBoards());
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "게시판 정보를 불러오지 못했습니다.");
      }
    }
    void load();
  }, []);

  return (
    <ModulePage
      eyebrow="관리자 / 게시판"
      title="게시판 관리"
      description="문서 보드와 활성 상태를 관리하고, 각 보드의 권한 정책은 UDMS 권한 화면에서 이어서 조정합니다."
      highlights={[
        `${boards.length}개 게시판`,
        "보드 권한은 /udms/permissions 에서 관리",
        "master 전용 설정 화면",
      ]}
      actions={[
        { href: "/udms/permissions", label: "보드 권한", variant: "secondary" },
        { href: "/admin", label: "관리자 홈", variant: "secondary" },
      ]}
    >
      {message ? (
        <div className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <section className="panel rounded-[28px] p-5">
        <h2 className="font-display text-2xl font-semibold text-slate-900">
          {draft.id ? "게시판 수정" : "게시판 추가"}
        </h2>
        <div className="mt-4 grid gap-3">
          <input
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            placeholder="게시판 이름"
            className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
          />
          <textarea
            value={draft.description}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            placeholder="게시판 설명"
            className="min-h-[120px] rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
          />
          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))}
            />
            활성 게시판
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={async () => {
                try {
                  const saved = draft.id
                    ? await updateBoard(draft.id, {
                        name: draft.name,
                        description: draft.description,
                        isActive: draft.isActive,
                      })
                    : await createBoard({
                        name: draft.name,
                        description: draft.description,
                        isActive: draft.isActive,
                      });
                  setBoards((current) => {
                    const next = current.filter((item) => item.id !== saved.id);
                    return [...next, saved].sort((left, right) => left.name.localeCompare(right.name));
                  });
                  setDraft(emptyDraft);
                  setMessage("게시판을 저장했습니다.");
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "게시판 저장에 실패했습니다.");
                }
              }}
              className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => setDraft(emptyDraft)}
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900"
            >
              초기화
            </button>
          </div>
        </div>
      </section>

      <section className="panel rounded-[28px] p-5">
        <h2 className="font-display text-2xl font-semibold text-slate-900">게시판 목록</h2>
        <div className="mt-4 grid gap-3">
          {boards.map((board) => (
            <button
              key={board.id}
              type="button"
              onClick={() =>
                setDraft({
                  id: board.id,
                  name: board.name,
                  description: board.description,
                  isActive: board.isActive,
                })
              }
              className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-left"
            >
              <p className="text-sm font-semibold text-slate-900">{board.name}</p>
              <p className="mt-1 text-sm text-slate-600">{board.description}</p>
            </button>
          ))}
        </div>
      </section>
    </ModulePage>
  );
}
