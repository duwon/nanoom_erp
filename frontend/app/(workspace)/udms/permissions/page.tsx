"use client";

import { useEffect, useMemo, useState } from "react";

import { getBoards, getTargetPolicies, replaceTargetPolicies } from "@/lib/api";
import type {
  Board,
  DocumentTargetType,
  PermissionSubjectType,
  TargetPolicyAction,
  TargetPolicyRule,
} from "@/lib/types";
import { ModulePage } from "@/components/module-page";
import { useTargetCatalog } from "@/components/udms/use-target-catalog";

type DraftRule = {
  subjectType: PermissionSubjectType;
  subjectId: string;
  actions: TargetPolicyAction[];
};

const createDraftRule = (): DraftRule => ({
  subjectType: "role",
  subjectId: "member",
  actions: ["read"],
});

export default function UdmsPermissionsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [targetType, setTargetType] = useState<DocumentTargetType>("Board");
  const [targetId, setTargetId] = useState("");
  const [rules, setRules] = useState<TargetPolicyRule[]>([]);
  const [drafts, setDrafts] = useState<DraftRule[]>([createDraftRule()]);
  const [message, setMessage] = useState("");
  const { enabledTargets, message: catalogMessage } = useTargetCatalog();

  useEffect(() => {
    async function loadBoards() {
      try {
        const boardItems = await getBoards();
        setBoards(boardItems);
        setTargetId((current) => current || boardItems[0]?.id || "");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to load boards.");
      }
    }

    void loadBoards();
  }, []);

  useEffect(() => {
    if (!enabledTargets.length) {
      return;
    }
    if (!enabledTargets.some((target) => target.targetType === targetType)) {
      const nextTargetType = enabledTargets[0]?.targetType ?? "Board";
      setTargetType(nextTargetType);
      setTargetId(nextTargetType === "Board" ? boards[0]?.id || "" : "");
    }
  }, [boards, enabledTargets, targetType]);

  useEffect(() => {
    if (!targetId) {
      setRules([]);
      setDrafts([createDraftRule()]);
      return;
    }

    async function loadPolicies() {
      try {
        const policyItems = await getTargetPolicies({ targetType, targetId });
        setRules(policyItems);
        setDrafts(
          policyItems.length
            ? policyItems.map((rule) => ({
                subjectType: rule.subjectType,
                subjectId: rule.subjectId,
                actions: rule.actions,
              }))
            : [createDraftRule()],
        );
        setMessage("");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to load target policies.");
      }
    }

    void loadPolicies();
  }, [targetId, targetType]);

  const currentBoard = useMemo(
    () => boards.find((board) => board.id === targetId) ?? null,
    [boards, targetId],
  );

  function toggleAction(index: number, action: TargetPolicyAction) {
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
      eyebrow="UDMS / Policies"
      title="Target Policies"
      description="Target policies define inherited create and read permissions before a document-level ACL override is evaluated."
      highlights={[
        targetType === "Board" && currentBoard ? `Current board: ${currentBoard.name}` : `Current target: ${targetType}`,
        `${rules.length} stored rules`,
        "Board is now one target type among the full registry",
      ]}
      actions={[{ href: "/admin/boards", label: "Board Admin", variant: "secondary" }]}
    >
      {message || catalogMessage ? (
        <div className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4 text-sm text-slate-700">
          {message || catalogMessage}
        </div>
      ) : null}

      <section className="panel rounded-[28px] p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Target Type</span>
            <select
              value={targetType}
              onChange={(event) => {
                const nextTargetType = event.target.value as DocumentTargetType;
                setTargetType(nextTargetType);
                setTargetId(nextTargetType === "Board" ? boards[0]?.id || "" : "");
              }}
              className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
            >
              {enabledTargets.map((target) => (
                <option key={target.targetType} value={target.targetType}>
                  {target.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Target ID</span>
            {targetType === "Board" ? (
              <select
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
                className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
              >
                <option value="">Select a board</option>
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
                placeholder="Target entity id"
                className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
              />
            )}
          </label>
        </div>
      </section>

      <section className="panel rounded-[28px] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold text-slate-900">Policy Rules</h2>
          <button
            type="button"
            onClick={() => setDrafts((current) => [...current, createDraftRule()])}
            className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900"
          >
            Add Rule
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
                  <option value="role">Role</option>
                  <option value="department">Department</option>
                  <option value="user">User</option>
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
                  placeholder="member, worship-team, user id"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {(["read", "create", "manage"] as TargetPolicyAction[]).map((action) => (
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
            disabled={!targetId}
            onClick={async () => {
              if (!targetId) {
                return;
              }

              try {
                const updated = await replaceTargetPolicies(
                  targetType,
                  targetId,
                  drafts.filter((draft) => draft.subjectId.trim().length > 0),
                );
                setRules(updated);
                setDrafts(
                  updated.length
                    ? updated.map((rule) => ({
                        subjectType: rule.subjectType,
                        subjectId: rule.subjectId,
                        actions: rule.actions,
                      }))
                    : [createDraftRule()],
                );
                setMessage("Target policies saved.");
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Failed to save target policies.");
              }
            }}
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Save Policies
          </button>
        </div>
      </section>
    </ModulePage>
  );
}
