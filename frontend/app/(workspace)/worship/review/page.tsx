"use client";

import { useEffect, useState } from "react";

import { activateWorshipPresentation, getWorshipReview } from "@/lib/api";
import { useWorshipContext } from "@/components/worship/use-worship-context";
import { WorshipWorkspaceShell, getWorshipStatusLabel, getWorshipStatusTheme } from "@/components/worship/workspace-shell";
import type { WorshipReviewResponse } from "@/lib/types";

export default function WorshipReviewPage() {
  const context = useWorshipContext();
  const service = context.service;
  const [review, setReview] = useState<WorshipReviewResponse | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!service) {
        return;
      }
      try {
        const response = await getWorshipReview(service.id);
        if (active) {
          setReview(response);
        }
      } catch (error) {
        if (active) {
          setMessage(error instanceof Error ? error.message : "검수 데이터를 불러오지 못했습니다.");
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [service]);

  return (
    <WorshipWorkspaceShell
      context={context}
      title="출력 / 검수"
      description="입력 중, 대기, 검수 필요 상태만 추려 보고 최종 송출 상태를 활성화합니다."
    >
      {service ? (
        <>
            {message ? (
              <div className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4 text-sm text-slate-700">
                {message}
              </div>
            ) : null}

            <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
              <article className="panel rounded-[28px] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      검수 리스트
                    </p>
                    <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900">
                      남은 항목
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      setLoading(true);
                      try {
                        await activateWorshipPresentation(
                          service.id,
                          review?.preview.sections.map((section) => section.id) ?? [],
                        );
                        setMessage("현재 검수 기준으로 display를 활성화했습니다.");
                      } catch (error) {
                        setMessage(error instanceof Error ? error.message : "송출 활성화에 실패했습니다.");
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
                  >
                    {loading ? "활성화 중..." : "현재 미리보기 송출"}
                  </button>
                </div>

                <div className="mt-5 grid gap-3">
                  {(review?.items ?? []).map((item) => (
                    <div key={item.sectionId} className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                            {item.order}
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-900">{item.title}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {item.detail || item.notes || "추가 정보 없음"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getWorshipStatusTheme(item.status)}`}
                        >
                          {getWorshipStatusLabel(item.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="panel rounded-[28px] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  ProPresenter 미리보기
                </p>
                <div className="mt-5 rounded-[28px] bg-slate-950 px-6 py-6 text-sm text-slate-100">
                  <pre className="overflow-x-auto whitespace-pre-wrap font-mono leading-7">
                    {JSON.stringify(review?.preview ?? service.exportSnapshot, null, 2)}
                  </pre>
                </div>
              </article>
            </section>
        </>
      ) : null}
    </WorshipWorkspaceShell>
  );
}
