"use client";

import { useEffect, useState } from "react";

import {
  createWorshipInputTemplate,
  deleteWorshipInputTemplate,
  listWorshipInputTemplates,
  updateWorshipInputTemplate,
} from "@/lib/api";
import type { WorshipInputTemplate, WorshipTaskFieldSpec } from "@/lib/types";

const emptyDraft = {
  id: "",
  label: "",
  description: "",
  tips: "",
  fields: [] as WorshipTaskFieldSpec[],
  isActive: true,
};

export default function AdminWorshipInputTemplatesPage() {
  const [items, setItems] = useState<WorshipInputTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [fieldsJson, setFieldsJson] = useState("[]");
  const [message, setMessage] = useState("");

  async function load() {
    const nextItems = await listWorshipInputTemplates();
    setItems(nextItems);
    const first = nextItems[0];
    if (first && !selectedId) {
      setSelectedId(first.id);
      setDraft({ ...first });
      setFieldsJson(JSON.stringify(first.fields, null, 2));
    }
  }

  useEffect(() => {
    void load().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "불러오기에 실패했습니다."));
  }, []);

  function selectItem(item: WorshipInputTemplate) {
    setSelectedId(item.id);
    setDraft({ ...item });
    setFieldsJson(JSON.stringify(item.fields, null, 2));
    setMessage("");
  }

  async function handleSave() {
    try {
      const nextDraft = { ...draft, fields: JSON.parse(fieldsJson) as WorshipTaskFieldSpec[] };
      const saved = selectedId
        ? await updateWorshipInputTemplate(selectedId, nextDraft)
        : await createWorshipInputTemplate(nextDraft);
      await load();
      selectItem(saved);
      setMessage("저장했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  }

  async function handleDelete() {
    if (!selectedId) return;
    try {
      await deleteWorshipInputTemplate(selectedId);
      setSelectedId(null);
      setDraft(emptyDraft);
      setFieldsJson("[]");
      await load();
      setMessage("삭제했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="space-y-3">
        <button type="button" onClick={() => { setSelectedId(null); setDraft(emptyDraft); setFieldsJson("[]"); }} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
          새 입력 템플릿
        </button>
        {items.map((item) => (
          <button key={item.id} type="button" onClick={() => selectItem(item)} className={`w-full rounded-xl border px-4 py-3 text-left ${selectedId === item.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white"}`}>
            <div className="text-sm font-semibold">{item.label}</div>
            <div className="mt-1 text-xs opacity-70">{item.id} · 필드 {item.fields.length} · 사용 {item.usageCount}</div>
          </button>
        ))}
      </aside>
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm"><span>ID</span><input value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} className="rounded-lg border px-3 py-2" /></label>
          <label className="grid gap-2 text-sm"><span>이름</span><input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} className="rounded-lg border px-3 py-2" /></label>
        </div>
        <label className="mt-4 grid gap-2 text-sm"><span>설명</span><input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="rounded-lg border px-3 py-2" /></label>
        <label className="mt-4 grid gap-2 text-sm"><span>안내 문구</span><textarea value={draft.tips} onChange={(e) => setDraft({ ...draft, tips: e.target.value })} className="min-h-24 rounded-lg border px-3 py-2" /></label>
        <label className="mt-4 grid gap-2 text-sm"><span>필드 스키마 JSON</span><textarea value={fieldsJson} onChange={(e) => setFieldsJson(e.target.value)} className="min-h-72 rounded-lg border px-3 py-2 font-mono text-xs" /></label>
        <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />활성화</label>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={() => void handleSave()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">저장</button>
          {selectedId ? <button type="button" onClick={() => void handleDelete()} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">삭제</button> : null}
        </div>
        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
      </section>
    </section>
  );
}
