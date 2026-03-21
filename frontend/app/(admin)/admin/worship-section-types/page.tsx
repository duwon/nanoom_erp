"use client";

import { useEffect, useState } from "react";

import {
  createWorshipSectionType,
  deleteWorshipSectionType,
  listWorshipInputTemplates,
  listWorshipSectionTypes,
  listWorshipSlideTemplates,
  updateWorshipSectionType,
} from "@/lib/api";
import type {
  WorshipInputTemplate,
  WorshipSectionTypeDefinition,
  WorshipSectionTypeDefinitionUpsert,
  WorshipSlideTemplate,
} from "@/lib/types";

const emptyDraft: WorshipSectionTypeDefinitionUpsert = {
  code: "",
  label: "",
  description: "",
  workspaceBucket: "content" as const,
  defaultTitle: "",
  defaultRole: "",
  defaultDurationMinutes: 0,
  defaultDueOffsetMinutes: 0,
  defaultInputTemplateId: "",
  defaultSlideTemplateKey: "",
  isActive: true,
  sortOrder: 0,
};

export default function AdminWorshipSectionTypesPage() {
  const [items, setItems] = useState<WorshipSectionTypeDefinition[]>([]);
  const [inputTemplates, setInputTemplates] = useState<WorshipInputTemplate[]>([]);
  const [slideTemplates, setSlideTemplates] = useState<WorshipSlideTemplate[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [draft, setDraft] = useState<WorshipSectionTypeDefinitionUpsert>(emptyDraft);
  const [message, setMessage] = useState("");

  async function load() {
    const [nextItems, nextInputs, nextSlides] = await Promise.all([
      listWorshipSectionTypes(),
      listWorshipInputTemplates(),
      listWorshipSlideTemplates(),
    ]);
    setItems(nextItems);
    setInputTemplates(nextInputs);
    setSlideTemplates(nextSlides);
    const first = nextItems[0];
    if (first && !selectedCode) {
      setSelectedCode(first.code);
      setDraft({ ...first });
    }
  }

  useEffect(() => {
    void load().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "불러오기에 실패했습니다."));
  }, []);

  function selectItem(item: WorshipSectionTypeDefinition) {
    setSelectedCode(item.code);
    setDraft({ ...item });
    setMessage("");
  }

  async function handleSave() {
    try {
      const saved = selectedCode
        ? await updateWorshipSectionType(selectedCode, draft)
        : await createWorshipSectionType(draft);
      await load();
      selectItem(saved);
      setMessage("저장했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  }

  async function handleDelete() {
    if (!selectedCode) return;
    try {
      await deleteWorshipSectionType(selectedCode);
      setSelectedCode(null);
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
        <button type="button" onClick={() => { setSelectedCode(null); setDraft(emptyDraft); }} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
          새 순서 타입
        </button>
        {items.map((item) => (
          <button key={item.code} type="button" onClick={() => selectItem(item)} className={`w-full rounded-xl border px-4 py-3 text-left ${selectedCode === item.code ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white"}`}>
            <div className="text-sm font-semibold">{item.label}</div>
            <div className="mt-1 text-xs opacity-70">{item.code} · {item.workspaceBucket} · 사용 {item.usageCount}</div>
          </button>
        ))}
      </aside>
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm"><span>코드</span><input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} className="rounded-lg border px-3 py-2" /></label>
          <label className="grid gap-2 text-sm"><span>이름</span><input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} className="rounded-lg border px-3 py-2" /></label>
          <label className="grid gap-2 text-sm"><span>버킷</span><select value={draft.workspaceBucket} onChange={(e) => setDraft({ ...draft, workspaceBucket: e.target.value as "music" | "content" })} className="rounded-lg border px-3 py-2"><option value="content">content</option><option value="music">music</option></select></label>
          <label className="grid gap-2 text-sm"><span>기본 역할</span><input value={draft.defaultRole} onChange={(e) => setDraft({ ...draft, defaultRole: e.target.value })} className="rounded-lg border px-3 py-2" /></label>
          <label className="grid gap-2 text-sm"><span>기본 제목</span><input value={draft.defaultTitle} onChange={(e) => setDraft({ ...draft, defaultTitle: e.target.value })} className="rounded-lg border px-3 py-2" /></label>
          <label className="grid gap-2 text-sm"><span>정렬 순서</span><input type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })} className="rounded-lg border px-3 py-2" /></label>
          <label className="grid gap-2 text-sm"><span>소요 시간</span><input type="number" value={draft.defaultDurationMinutes} onChange={(e) => setDraft({ ...draft, defaultDurationMinutes: Number(e.target.value) })} className="rounded-lg border px-3 py-2" /></label>
          <label className="grid gap-2 text-sm"><span>마감 offset</span><input type="number" value={draft.defaultDueOffsetMinutes} onChange={(e) => setDraft({ ...draft, defaultDueOffsetMinutes: Number(e.target.value) })} className="rounded-lg border px-3 py-2" /></label>
          <label className="grid gap-2 text-sm"><span>입력 템플릿</span><select value={draft.defaultInputTemplateId} onChange={(e) => setDraft({ ...draft, defaultInputTemplateId: e.target.value })} className="rounded-lg border px-3 py-2">{inputTemplates.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label className="grid gap-2 text-sm"><span>슬라이드 템플릿</span><select value={draft.defaultSlideTemplateKey} onChange={(e) => setDraft({ ...draft, defaultSlideTemplateKey: e.target.value })} className="rounded-lg border px-3 py-2"><option value="">없음</option>{slideTemplates.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
        </div>
        <label className="mt-4 grid gap-2 text-sm"><span>설명</span><textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="min-h-32 rounded-lg border px-3 py-2" /></label>
        <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />활성화</label>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={() => void handleSave()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">저장</button>
          {selectedCode ? <button type="button" onClick={() => void handleDelete()} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">삭제</button> : null}
        </div>
        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
      </section>
    </section>
  );
}
