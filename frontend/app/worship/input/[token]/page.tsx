"use client";

import { use, useEffect, useState } from "react";

import { getWorshipGuestInput, submitWorshipGuestInput } from "@/lib/api";
import type { WorshipGuestTaskView } from "@/lib/types";

export default function WorshipGuestInputPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [view, setView] = useState<WorshipGuestTaskView | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await getWorshipGuestInput(token);
        if (!active) {
          return;
        }
        setView(response);
        setValues(response.values);
      } catch (error) {
        if (!active) {
          return;
        }
        setMessage(error instanceof Error ? error.message : "게스트 입력 정보를 불러오지 못했습니다.");
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-10">
      <section className="panel-strong rounded-[32px] px-6 py-8">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-700">
          Worship Guest Input
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-slate-900">
          {view?.role ?? "입력 링크"}
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          {view?.serviceName ?? ""} / {view?.scope ?? ""}
        </p>

        {message ? (
          <div className="mt-5 rounded-[20px] border border-slate-200 bg-white/80 px-4 py-4 text-sm text-slate-700">
            {message}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4">
          {view?.requiredFields.map((field) => (
            <label key={field.key} className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">{field.label}</span>
              {field.fieldType === "textarea" || field.fieldType === "lyrics" ? (
                <textarea
                  rows={field.fieldType === "lyrics" ? 10 : 6}
                  value={String(values[field.key] ?? "")}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [field.key]: event.target.value }))
                  }
                  className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-emerald-400"
                />
              ) : (
                <input
                  value={String(values[field.key] ?? "")}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [field.key]: event.target.value }))
                  }
                  className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-emerald-400"
                />
              )}
              {field.helpText ? <span className="text-xs text-slate-500">{field.helpText}</span> : null}
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={async () => {
            setSaving(true);
            try {
              const response = await submitWorshipGuestInput(token, values);
              setView(response);
              setValues(response.values);
              setMessage("입력을 제출했습니다.");
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "제출에 실패했습니다.");
            } finally {
              setSaving(false);
            }
          }}
          className="mt-6 w-full rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
        >
          {saving ? "제출 중..." : "제출"}
        </button>
      </section>
    </main>
  );
}
