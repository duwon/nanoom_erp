"use client";

import { useState } from "react";

import { issueWorshipGuestLink } from "@/lib/api";
import { useWorshipContext } from "@/components/worship/use-worship-context";
import { WorshipWorkspaceShell, getWorshipStatusLabel, getWorshipStatusTheme } from "@/components/worship/workspace-shell";

export default function WorshipAssigneesPage() {
  const context = useWorshipContext();
  const service = context.service;
  const [message, setMessage] = useState("");
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);

  return (
    <WorshipWorkspaceShell
      context={context}
      title="담당자 입력함"
      description="역할별 최소 입력 필드만 보여주고, 필요하면 게스트 링크를 발급해 모바일 입력으로 연결합니다."
    >
      {service ? (
        <>
            {message ? (
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
                {message}
              </div>
            ) : null}

            <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <article className="grid gap-4">
                {service.tasks.map((task) => (
                  <div key={task.id} className="panel rounded-[28px] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                          {task.role}
                        </p>
                        <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900">
                          {task.scope}
                        </h2>
                        <p className="mt-2 text-sm leading-7 text-slate-600">{task.tips}</p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getWorshipStatusTheme(task.status)}`}
                      >
                        {getWorshipStatusLabel(task.status)}
                      </span>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {task.requiredFields.map((field) => (
                        <span
                          key={field.key}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
                        >
                          {field.label}
                        </span>
                      ))}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={async () => {
                          setLoadingTaskId(task.id);
                          try {
                            const response = await issueWorshipGuestLink(service.id, task.id);
                            setMessage(`게스트 입력 링크 발급: ${response.inputUrl}`);
                            await navigator.clipboard.writeText(response.inputUrl);
                          } catch (error) {
                            setMessage(error instanceof Error ? error.message : "링크 발급에 실패했습니다.");
                          } finally {
                            setLoadingTaskId(null);
                          }
                        }}
                        className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
                      >
                        {loadingTaskId === task.id ? "발급 중..." : "모바일 링크 보내기"}
                      </button>
                    </div>
                  </div>
                ))}
              </article>

              <article className="panel rounded-[28px] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  모바일 입력 프리뷰
                </p>
                <div className="mt-5 rounded-[28px] border border-slate-200 bg-slate-950 px-5 py-6 text-white">
                  <p className="text-sm font-medium text-emerald-300">특송팀 링크 예시</p>
                  <h3 className="mt-3 text-2xl font-semibold">특송 제목 / 가사만 입력</h3>
                  <div className="mt-5 grid gap-3">
                    <div className="rounded-[20px] bg-white/10 px-4 py-3 text-sm">특송 제목</div>
                    <div className="rounded-[20px] bg-white/10 px-4 py-4 text-sm">가사 붙여넣기</div>
                    <div className="rounded-full bg-emerald-500 px-4 py-3 text-center text-sm font-semibold text-slate-950">
                      제출
                    </div>
                  </div>
                </div>
              </article>
            </section>
        </>
      ) : null}
    </WorshipWorkspaceShell>
  );
}
