"use client";

import { useEffect, useState } from "react";

import type { DocumentAclAction, DocumentAclEffect, DocumentAclRule, PermissionSubjectType } from "@/lib/types";

type AclManagerProps = {
  acl: DocumentAclRule[];
  canManage: boolean;
  onSave: (acl: DocumentAclRule[]) => Promise<void>;
};

const createEmptyRule = (): DocumentAclRule => ({
  subjectType: "department",
  subjectId: "",
  actions: ["read"],
  effect: "allow",
});

export function AclManager({ acl, canManage, onSave }: AclManagerProps) {
  const [drafts, setDrafts] = useState<DocumentAclRule[]>(acl.length ? acl : [createEmptyRule()]);

  useEffect(() => {
    setDrafts(acl.length ? acl : [createEmptyRule()]);
  }, [acl]);

  function toggleAction(index: number, action: DocumentAclAction) {
    setDrafts((current) =>
      current.map((rule, ruleIndex) =>
        ruleIndex !== index
          ? rule
          : {
              ...rule,
              actions: rule.actions.includes(action)
                ? rule.actions.filter((item) => item !== action)
                : [...rule.actions, action],
            },
      ),
    );
  }

  return (
    <section className="panel rounded-[28px] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">ACL</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900">Document Access Rules</h2>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => setDrafts((current) => [...current, createEmptyRule()])}
            className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900"
          >
            Add Rule
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3">
        {drafts.map((rule, index) => (
          <div key={`${rule.subjectType}-${index}`} className="grid gap-3 rounded-[20px] border border-slate-200 bg-white px-4 py-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <select
                value={rule.subjectType}
                disabled={!canManage}
                onChange={(event) =>
                  setDrafts((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, subjectType: event.target.value as PermissionSubjectType }
                        : item,
                    ),
                  )
                }
                className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400 disabled:opacity-70"
              >
                <option value="role">Role</option>
                <option value="department">Department</option>
                <option value="user">User</option>
              </select>

              <input
                value={rule.subjectId}
                disabled={!canManage}
                onChange={(event) =>
                  setDrafts((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, subjectId: event.target.value } : item,
                    ),
                  )
                }
                className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400 disabled:opacity-70"
                placeholder="member, worship-team, user id"
              />

              <select
                value={rule.effect}
                disabled={!canManage}
                onChange={(event) =>
                  setDrafts((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, effect: event.target.value as DocumentAclEffect }
                        : item,
                    ),
                  )
                }
                className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400 disabled:opacity-70"
              >
                <option value="allow">Allow</option>
                <option value="deny">Deny</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              {(["read", "edit", "manage", "publish"] as DocumentAclAction[]).map((action) => (
                <button
                  key={action}
                  type="button"
                  disabled={!canManage}
                  onClick={() => toggleAction(index, action)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    rule.actions.includes(action)
                      ? "bg-slate-900 text-white"
                      : "border border-slate-300 bg-white text-slate-700"
                  } disabled:opacity-70`}
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {canManage ? (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => void onSave(drafts.filter((rule) => rule.subjectId.trim().length > 0))}
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
          >
            Save ACL
          </button>
        </div>
      ) : null}
    </section>
  );
}
