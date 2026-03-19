"use client";

import { useEffect, useMemo, useState } from "react";

import { ModulePage } from "@/components/module-page";
import { listAdminUsers, updateAdminUser } from "@/lib/api";
import type { AuthUser, UserRole, UserStatus } from "@/lib/types";

const roleOptions: UserRole[] = ["master", "final_approver", "editor", "member"];
const statusOptions: UserStatus[] = ["pending", "active", "blocked"];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { role: UserRole; status: UserStatus }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadUsers() {
      setIsLoading(true);
      setMessage("");
      try {
        const response = await listAdminUsers();
        setUsers(response);
        setDrafts(
          Object.fromEntries(
            response.map((user) => [user.id, { role: user.role, status: user.status }]),
          ),
        );
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "사용자 목록을 불러오지 못했습니다.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadUsers();
  }, []);

  const pendingCount = useMemo(
    () => users.filter((user) => user.status === "pending").length,
    [users],
  );

  function updateDraft(userId: string, patch: Partial<{ role: UserRole; status: UserStatus }>) {
    setDrafts((current) => ({
      ...current,
      [userId]: {
        ...(current[userId] ?? { role: "member", status: "pending" }),
        ...patch,
      },
    }));
  }

  async function handleSave(userId: string) {
    const draft = drafts[userId];
    if (!draft) {
      return;
    }

    setSavingUserId(userId);
    setMessage("");
    try {
      const updated = await updateAdminUser(userId, draft);
      setUsers((current) => current.map((user) => (user.id === userId ? updated : user)));
      setDrafts((current) => ({
        ...current,
        [userId]: { role: updated.role, status: updated.status },
      }));
      setMessage("사용자 상태를 저장했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "사용자 저장에 실패했습니다.");
    } finally {
      setSavingUserId(null);
    }
  }

  return (
    <ModulePage
      eyebrow="Admin / Users"
      title="사용자 관리"
      description="소셜 로그인 계정의 승인 상태와 역할을 조정합니다."
      highlights={[
        `승인 대기 ${pendingCount}명`,
        "master만 관리자 접근 허용",
        "pending/active/blocked 상태 전환",
      ]}
      actions={[{ href: "/admin", label: "관리자 홈" }]}
    >
      {message ? (
        <div className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4 text-sm text-slate-700">
          사용자 목록을 불러오는 중입니다.
        </div>
      ) : null}

      {users.map((user) => {
        const draft = drafts[user.id] ?? { role: user.role, status: user.status };

        return (
          <section key={user.id} className="panel rounded-[28px] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  {user.socialProvider}
                </p>
                <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900">
                  {user.name ?? "이름 미입력"}
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">{user.email}</p>
                <p className="text-sm leading-7 text-slate-600">
                  {user.position ?? "직분 미입력"} / {user.department ?? "부서 미입력"}
                </p>
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
                {user.status}
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">역할</span>
                <select
                  value={draft.role}
                  onChange={(event) => updateDraft(user.id, { role: event.target.value as UserRole })}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">상태</span>
                <select
                  value={draft.status}
                  onChange={(event) =>
                    updateDraft(user.id, { status: event.target.value as UserStatus })
                  }
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-xs tracking-[0.2em] text-slate-500">
                승인일: {user.approvedAt ?? "미승인"}
              </p>
              <button
                type="button"
                onClick={() => void handleSave(user.id)}
                disabled={savingUserId === user.id}
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingUserId === user.id ? "저장 중..." : "변경 저장"}
              </button>
            </div>
          </section>
        );
      })}
    </ModulePage>
  );
}
