"use client";

import { useEffect, useMemo, useState } from "react";

import { getBoardPermissionRules, getBoards, replaceBoardPermissionRules } from "@/lib/api";
import type { Board, BoardPermissionAction, BoardPermissionRule, PermissionSubjectType } from "@/lib/types";
import { ModulePage } from "@/components/module-page";

type DraftRule = {
  subjectType: PermissionSubjectType;
  subjectId: string;
  actions: BoardPermissionAction[];
};

export default function UdmsPermissionsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [rules, setRules] = useState<BoardPermissionRule[]>([]);
  const [drafts, setDrafts] = useState<DraftRule[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [boardItems, ruleItems] = await Promise.all([getBoards(), getBoardPermissionRules()]);
        setBoards(boardItems);
        setRules(ruleItems);
        setSelectedBoardId(boardItems[0]?.id ?? "");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "권한 정보를 불러오지 못했습니다.");
      }
    }
    void load();
  }, []);

  useEffect(() => {
    if (!selectedBoardId) {
      return;
    }
    const nextDrafts = rules
      .filter((rule) => rule.boardId === selectedBoardId)
      .map((rule) => ({ subjectType: rule.subjectType, subjectId: rule.subjectId, actions: rule.actions }));
    setDrafts(nextDrafts.length ? nextDrafts : [{ subjectType: "role", subjectId: "member", actions: ["read"] }]);
  }, [rules, selectedBoardId]);

  const currentBoard = useMemo(
    () => boards.find((board) => board.id === selectedBoardId) ?? null,
    [boards, selectedBoardId],
  );

  function toggleAction(index: number, action: BoardPermissionAction) {
    setDrafts((current) =>
      current.map((draft, draftIndex) =>
        draftIndex !== index
          ? draft
          : {
              ...draft,
              actions: draft.actions.includes(action)
                ? draft.actions.filter((item) => item !== action)
                : [...draft.actions, action],
            },
      ),
    );
  }

  return (
    <ModulePage
      eyebrow="문서 관리 / 권한"
      title="보드 권한"
      description="보드별 읽기, 생성, 관리 정책을 role, user, department 단위로 관리합니다."
      highlights={[
        currentBoard ? `${currentBoard.name} 선택됨` : "보드 선택 필요",
        "권한 관리 API는 master 전용",
        "문서 공유는 상세 화면에서 별도 관리",
      ]}
      actions={[{ href: "/admin/boards", label: "게시판 관리", variant: "secondary" }]}
    >
      {message ? (
        <div className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <section className="panel rounded-[28px] p-5">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">게시판 선택</span>
          <select
            value={selectedBoardId}
            onChange={(event) => setSelectedBoardId(event.target.value)}
            className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
          >
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="panel rounded-[28px] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold text-slate-900">권한 규칙</h2>
          <button
            type="button"
            onClick={() =>
              setDrafts((current) => [
                ...current,
                { subjectType: "role", subjectId: "member", actions: ["read"] },
              ])
            }
            className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900"
          >
            규칙 추가
          </button>
        </div>
        <div className="mt-4 grid gap-3">
          {drafts.map((draft, index) => (
            <div key={`${draft.subjectType}-${index}`} className="grid gap-3 rounded-[20px] border border-slate-200 bg-white px-4 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={draft.subjectType}
                  onChange={(event) =>
                    setDrafts((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, subjectType: event.target.value as PermissionSubjectType }
                          : item,
                      ),
                    )
                  }
                  className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                >
                  <option value="role">역할</option>
                  <option value="department">부서</option>
                  <option value="user">사용자</option>
                </select>
                <input
                  value={draft.subjectId}
                  onChange={(event) =>
                    setDrafts((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, subjectId: event.target.value } : item,
                      ),
                    )
                  }
                  className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {(["read", "create", "manage"] as BoardPermissionAction[]).map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => toggleAction(index, action)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      draft.actions.includes(action)
                        ? "bg-slate-900 text-white"
                        : "border border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={async () => {
              if (!selectedBoardId) {
                return;
              }
              try {
                const updated = await replaceBoardPermissionRules(
                  selectedBoardId,
                  drafts.filter((draft) => draft.subjectId.trim().length > 0),
                );
                setRules((current) => [
                  ...current.filter((rule) => rule.boardId !== selectedBoardId),
                  ...updated,
                ]);
                setMessage("권한 규칙을 저장했습니다.");
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "권한 저장에 실패했습니다.");
              }
            }}
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
          >
            권한 저장
          </button>
        </div>
      </section>
    </ModulePage>
  );
}
