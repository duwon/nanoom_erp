"use client";

import { useMemo, useState } from "react";

import { lookupWorshipSongs, parseWorshipLyrics, updateWorshipSection } from "@/lib/api";
import { useWorshipContext } from "@/components/worship/use-worship-context";
import { WorshipWorkspaceShell } from "@/components/worship/workspace-shell";
import type { WorshipSection, WorshipSongLookupItem } from "@/lib/types";

function isSongSection(section: WorshipSection) {
  return section.sectionType === "song" || section.sectionType === "special_song";
}

export default function WorshipSongsPage() {
  const context = useWorshipContext();
  const service = context.service;
  const [drafts, setDrafts] = useState<Record<string, { title: string; lyrics: string }>>({});
  const [suggestions, setSuggestions] = useState<Record<string, WorshipSongLookupItem[]>>({});
  const [message, setMessage] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const sections = useMemo(() => (service ? service.sections.filter(isSongSection) : []), [service]);

  return (
    <WorshipWorkspaceShell
      context={context}
      title="찬양 / 특송 입력"
      description="곡 제목과 가사를 붙여넣고 자동 분할 결과를 확인한 뒤, 16:9 미리보기 기준으로 저장합니다."
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
                  title: String(section.content.songTitle ?? section.title ?? ""),
                  lyrics: String(section.content.lyrics ?? ""),
                };
                return (
                  <article key={section.id} className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                    <div className="panel rounded-[28px] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                        {section.title}
                      </p>
                      <div className="mt-5 grid gap-4">
                        <label className="grid gap-2">
                          <span className="text-sm font-medium text-slate-700">곡 제목</span>
                          <input
                            value={draft.title}
                            onChange={(event) => {
                              const title = event.target.value;
                              setDrafts((current) => ({
                                ...current,
                                [section.id]: { ...draft, title },
                              }));
                              if (title.trim().length >= 2) {
                                void lookupWorshipSongs(title)
                                  .then((items) => {
                                    setSuggestions((current) => ({
                                      ...current,
                                      [section.id]: items,
                                    }));
                                  })
                                  .catch((error) => {
                                    setMessage(
                                      error instanceof Error ? error.message : "곡 검색에 실패했습니다.",
                                    );
                                  });
                              } else {
                                setSuggestions((current) => ({
                                  ...current,
                                  [section.id]: [],
                                }));
                              }
                            }}
                            className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-emerald-400"
                          />
                        </label>

                        {suggestions[section.id]?.length ? (
                          <div className="flex flex-wrap gap-2">
                            {suggestions[section.id].map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() =>
                                  setDrafts((current) => ({
                                    ...current,
                                    [section.id]: { ...draft, title: item.title },
                                  }))
                                }
                                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
                              >
                                {item.title}
                              </button>
                            ))}
                          </div>
                        ) : null}

                        <label className="grid gap-2">
                          <span className="text-sm font-medium text-slate-700">가사</span>
                          <textarea
                            value={draft.lyrics}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [section.id]: { ...draft, lyrics: event.target.value },
                              }))
                            }
                            rows={12}
                            className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-emerald-400"
                          />
                        </label>

                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={async () => {
                              setLoadingId(section.id);
                              try {
                                const parsed = await parseWorshipLyrics(service.id, section.id, {
                                  lyrics: draft.lyrics,
                                  templateKey: section.templateKey || "lyrics-16x9",
                                });
                                const nextService = await updateWorshipSection(service.id, section.id, {
                                  version: service.version,
                                  title: draft.title,
                                  content: { ...section.content, songTitle: draft.title, lyrics: draft.lyrics },
                                  slides: parsed.slides,
                                  status: "review",
                                });
                                context.setService(nextService);
                                setMessage("가사 분할 결과를 저장했습니다.");
                              } catch (error) {
                                setMessage(error instanceof Error ? error.message : "가사 저장에 실패했습니다.");
                              } finally {
                                setLoadingId(null);
                              }
                            }}
                            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
                          >
                            {loadingId === section.id ? "저장 중..." : "자동 분할 후 저장"}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="panel rounded-[28px] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                        16:9 미리보기
                      </p>
                      <div className="mt-5 grid gap-4">
                        <div className="rounded-[28px] bg-slate-950 px-6 py-10 text-white shadow-inner">
                          <p className="text-sm font-medium text-emerald-300">{draft.title || section.title}</p>
                          <div className="mt-5 space-y-6">
                            {(section.slides.length ? section.slides : []).map((slide) => (
                              <div key={slide.id} className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-4">
                                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                                  {slide.label}
                                </p>
                                <p className="mt-3 whitespace-pre-wrap text-2xl leading-[1.6]">
                                  {slide.lines.join("\n")}
                                </p>
                              </div>
                            ))}
                            {!section.slides.length ? (
                              <div className="rounded-[20px] border border-dashed border-white/10 px-4 py-8 text-sm text-slate-400">
                                자동 분할 후 슬라이드가 여기에 표시됩니다.
                              </div>
                            ) : null}
                          </div>
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
