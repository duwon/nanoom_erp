"use client";

import { useEffect, useState } from "react";

import {
  createWorshipSlideTemplate,
  deleteWorshipSlideTemplate,
  listWorshipSlideTemplates,
  updateWorshipSlideTemplate,
} from "@/lib/api";
import type { WorshipSlideTemplate } from "@/lib/types";

const emptyDraft = {
  key: "",
  label: "",
  description: "",
  isActive: true,
};

export default function AdminWorshipSlideTemplatesPage() {
  const [items, setItems] = useState<WorshipSlideTemplate[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [message, setMessage] = useState("");

  async function load() {
    const nextItems = await listWorshipSlideTemplates();
    setItems(nextItems);
    const first = nextItems[0];
    if (first && !selectedKey) {
      setSelectedKey(first.key);
      setDraft({ ...first });
    }
  }

  useEffect(() => {
    void load().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "불러오기에 실패했습니다."));
  }, []);

  function selectItem(item: WorshipSlideTemplate) {
    setSelectedKey(item.key);
    setDraft({ ...item });
    setMessage("");
  }

  async function handleSave() {
    try {
      const saved = selectedKey
        ? await updateWorshipSlideTemplate(selectedKey, draft)
        : await createWorshipSlideTemplate(draft);
      await load();
      selectItem(saved);
      setMessage("저장했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  }

  async function handleDelete() {
    if (!selectedKey) return;
    try {
      await deleteWorshipSlideTemplate(selectedKey);
      setSelectedKey(null);
      setDraft(emptyDraft);
      await load();
      setMessage("삭제했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="space-y-3">
        <button type="button" onClick={() => { setSelectedKey(null); setDraft(emptyDraft); }} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
          새 슬라이드 템플릿
        </button>
        {items.map((item) => (
          <button key={item.key} type="button" onClick={() => selectItem(item)} className={`w-full rounded-xl border px-4 py-3 text-left ${selectedKey === item.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white"}`}>
            <div className="text-sm font-semibold">{item.label}</div>
            <div className="mt-1 text-xs opacity-70">{item.key} · 사용 {item.usageCount}</div>
          </button>
        ))}
      </aside>
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm"><span>키</span><input value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} className="rounded-lg border px-3 py-2" /></label>
          <label className="grid gap-2 text-sm"><span>이름</span><input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} className="rounded-lg border px-3 py-2" /></label>
        </div>
        <label className="mt-4 grid gap-2 text-sm"><span>설명</span><textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="min-h-32 rounded-lg border px-3 py-2" /></label>
        <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />활성화</label>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={() => void handleSave()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">저장</button>
          {selectedKey ? <button type="button" onClick={() => void handleDelete()} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">삭제</button> : null}
        </div>
        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
      </section>
    </section>
  );
}
