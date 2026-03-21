"use client";

import { use, useEffect, useRef, useState } from "react";

import { getWorshipGuestInput, submitWorshipGuestInput } from "@/lib/api";
import type { WorshipGuestTaskView } from "@/lib/types";
import { WorshipTaskForm } from "@/components/worship/task-form";

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
  const snapshotRef = useRef("");

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
        snapshotRef.current = JSON.stringify(response.values);
      } catch (error) {
        if (!active) {
          return;
        }
        setMessage(error instanceof Error ? error.message : "입력 링크를 불러오지 못했습니다.");
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    const nextSnapshot = JSON.stringify(values);
    if (!view || !nextSnapshot || nextSnapshot === snapshotRef.current) {
      return;
    }
    const timer = window.setTimeout(async () => {
      setSaving(true);
      try {
        const response = await submitWorshipGuestInput(token, values, false);
        setView(response);
        snapshotRef.current = JSON.stringify(response.values);
        setMessage("자동 저장됨");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "자동 저장에 실패했습니다.");
      } finally {
        setSaving(false);
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [token, values, view]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-10">
      <section className="panel-strong rounded-[28px] px-6 py-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Worship Guest Input</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{view?.role ?? "입력 링크"}</h1>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          {view?.serviceName ?? ""} / {view?.scope ?? ""}
        </p>

        {message ? (
          <div className="mt-5 rounded-[20px] border border-slate-200 bg-white/80 px-4 py-4 text-sm text-slate-700">
            {message}
          </div>
        ) : null}

        {view ? (
          <div className="mt-6">
            <WorshipTaskForm
              fields={view.requiredFields}
              values={values}
              onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
              className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-emerald-400"
            />
          </div>
        ) : null}

        <button
          type="button"
          onClick={async () => {
            setSaving(true);
            try {
              const response = await submitWorshipGuestInput(token, values, true);
              setView(response);
              setValues(response.values);
              snapshotRef.current = JSON.stringify(response.values);
              setMessage("입력 완료로 제출했습니다.");
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "완료 제출에 실패했습니다.");
            } finally {
              setSaving(false);
            }
          }}
          className="mt-6 w-full rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
        >
          {saving ? "저장 중..." : "입력 완료"}
        </button>
      </section>
    </main>
  );
}
