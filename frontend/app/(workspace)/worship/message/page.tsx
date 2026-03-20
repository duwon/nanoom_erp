"use client";

import { useMemo, useState } from "react";

import { lookupWorshipScripture, updateWorshipSection } from "@/lib/api";
import { useWorshipContext } from "@/components/worship/use-worship-context";
import { WorshipWorkspaceShell } from "@/components/worship/workspace-shell";
import type { WorshipSection } from "@/lib/types";

function isMessageSection(section: WorshipSection) {
  return section.sectionType === "scripture" || section.sectionType === "message" || section.sectionType === "notice";
}

export default function WorshipMessagePage() {
  const context = useWorshipContext();
  const service = context.service;
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { reference: string; notes: string; templateKey: string }>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const sections = useMemo(() => (service ? service.sections.filter(isMessageSection) : []), [service]);

  return (
    <WorshipWorkspaceShell
      context={context}
      title="성경 / 말씀 입력"
      description="장절 기반 본문 불러오기와 설교 포인트 정리를 한 흐름으로 묶고, 템플릿별 미리보기를 같이 확인합니다."
    >
      {service ? (
        <>
            {message ? (
              <div className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4 text-sm text-slate-700">
                {message}
              </div>
            ) : null}

            <section className="grid gap-6">
              {sections.map((section) => {
                const draft = drafts[section.id] ?? {
                  reference: String(section.content.reference ?? section.detail ?? ""),
                  notes: String(section.content.notes ?? section.notes ?? ""),
                  templateKey: section.templateKey || "scripture-main",
                };
                return (
                  <article key={section.id} className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                    <div className="panel rounded-[28px] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                        {section.title}
                      </p>
                      <div className="mt-5 grid gap-4">
                        <label className="grid gap-2">
                          <span className="text-sm font-medium text-slate-700">본문</span>
                          <input
                            value={draft.reference}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [section.id]: { ...draft, reference: event.target.value },
                              }))
                            }
                            placeholder="예: 요한복음 3:16-17"
                            className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-emerald-400"
                          />
                        </label>

                        <label className="grid gap-2">
                          <span className="text-sm font-medium text-slate-700">메모</span>
                          <textarea
                            value={draft.notes}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [section.id]: { ...draft, notes: event.target.value },
                              }))
                            }
                            rows={8}
                            className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-emerald-400"
                          />
                        </label>

                        <label className="grid gap-2">
                          <span className="text-sm font-medium text-slate-700">템플릿</span>
                          <select
                            value={draft.templateKey}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [section.id]: { ...draft, templateKey: event.target.value },
                              }))
                            }
                            className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-emerald-400"
                          >
                            <option value="scripture-main">말씀 자막용</option>
                            <option value="message-notes">설교 포인트용</option>
                            <option value="notice-card">공지 카드용</option>
                          </select>
                        </label>

                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={async () => {
                              setLoadingId(section.id);
                              try {
                                let slides = section.slides;
                                const match = draft.reference.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);
                                if (match) {
                                  const scripture = await lookupWorshipScripture({
                                    book: match[1],
                                    chapter: Number(match[2]),
                                    verseStart: Number(match[3]),
                                    verseEnd: match[4] ? Number(match[4]) : undefined,
                                  });
                                  slides = scripture.slides;
                                }
                                const nextService = await updateWorshipSection(service.id, section.id, {
                                  version: service.version,
                                  detail: draft.reference,
                                  notes: draft.notes,
                                  templateKey: draft.templateKey,
                                  content: { ...section.content, reference: draft.reference, notes: draft.notes },
                                  slides,
                                  status: "review",
                                });
                                context.setService(nextService);
                                setMessage("본문/말씀 정보를 저장했습니다.");
                              } catch (error) {
                                setMessage(error instanceof Error ? error.message : "본문 저장에 실패했습니다.");
                              } finally {
                                setLoadingId(null);
                              }
                            }}
                            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
                          >
                            {loadingId === section.id ? "저장 중..." : "본문 불러와 저장"}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="panel rounded-[28px] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                        미리보기
                      </p>
                      <div className="mt-5 rounded-[28px] bg-slate-950 px-6 py-10 text-white">
                        <p className="text-sm font-medium text-emerald-300">{draft.reference || section.title}</p>
                        <div className="mt-5 grid gap-4">
                          {(section.slides.length ? section.slides : []).map((slide) => (
                            <div key={slide.id} className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-4">
                              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{slide.label}</p>
                              <p className="mt-3 whitespace-pre-wrap text-2xl leading-[1.6]">
                                {slide.lines.join("\n")}
                              </p>
                            </div>
                          ))}
                          {!section.slides.length ? (
                            <div className="rounded-[20px] border border-dashed border-white/10 px-4 py-8 text-sm text-slate-400">
                              본문 조회 후 여기에 슬라이드가 표시됩니다.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
        </>
      ) : null}
    </WorshipWorkspaceShell>
  );
}
