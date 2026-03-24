"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type DragOverEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createWorshipTemplate, deleteWorshipTemplate, listWorshipInputTemplates, listWorshipSectionTypes, listWorshipSlideTemplates, listWorshipTemplates, updateWorshipTemplate } from "@/lib/api";
import type { WorshipGenerationRule, WorshipInputTemplate, WorshipSectionTypeDefinition, WorshipSlideTemplate, WorshipTemplate, WorshipTemplateSectionPreset } from "@/lib/types";

type Draft = { id?: string; serviceKind: string; displayName: string; startTime: string; generationRule: WorshipGenerationRule; isActive: boolean; defaultSections: WorshipTemplateSectionPreset[] };
const emptyDraft: Draft = { serviceKind: "", displayName: "", startTime: "09:00", generationRule: "sunday", isActive: false, defaultSections: [] };
const rules: Array<{ value: WorshipGenerationRule; label: string }> = [{ value: "daily", label: "매일" }, { value: "sunday", label: "주일" }, { value: "wednesday", label: "수요일" }, { value: "friday", label: "금요일" }];
const j = <T,>(v: T) => JSON.parse(JSON.stringify(v)) as T;
const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const sid = (t: string, n: string) => slug(`${t}-${n}`) || `section-${t}-${Math.random().toString(36).slice(2, 8)}`;
const norm = (items: WorshipTemplateSectionPreset[]) => items.map((item, i) => ({ ...item, order: i + 1 }));
const dedupeIds = (sections: WorshipTemplateSectionPreset[]): WorshipTemplateSectionPreset[] => { const seen = new Set<string>(); return sections.map((s) => { let id = s.id; while (seen.has(id)) id = `${s.id}-${Math.random().toString(36).slice(2, 8)}`; seen.add(id); return id === s.id ? s : { ...s, id }; }); };
const fromTemplate = (t: WorshipTemplate): Draft => ({ id: t.id, serviceKind: t.serviceKind, displayName: t.displayName, startTime: t.startTime, generationRule: t.generationRule, isActive: t.isActive, defaultSections: norm(dedupeIds(t.defaultSections.map((s) => ({ ...s, sectionTypeCode: s.sectionTypeCode ?? s.sectionType, sectionType: s.sectionType ?? s.sectionTypeCode ?? "", inputTemplateId: s.inputTemplateId ?? "", slideTemplateKey: s.slideTemplateKey ?? s.templateKey ?? "", templateKey: s.templateKey ?? s.slideTemplateKey ?? "", dueOffsetMinutes: s.dueOffsetMinutes ?? 0, workspaceBucket: s.workspaceBucket ?? "content" })))) });
const makeSection = (t: WorshipSectionTypeDefinition): WorshipTemplateSectionPreset => ({ id: `${sid(t.code, t.defaultTitle || t.label)}-${Math.random().toString(36).slice(2, 8)}`, order: 1, sectionTypeCode: t.code, sectionType: t.code, title: t.defaultTitle || t.label, detail: "", role: t.defaultRole || "", assigneeName: null, durationMinutes: t.defaultDurationMinutes ?? 0, dueOffsetMinutes: t.defaultDueOffsetMinutes ?? 0, inputTemplateId: t.defaultInputTemplateId || "", slideTemplateKey: t.defaultSlideTemplateKey || "", templateKey: t.defaultSlideTemplateKey || "", workspaceBucket: t.workspaceBucket, notes: "", content: {} });
const copyDraft = (d: Draft): Draft => ({ ...j(d), id: undefined, displayName: `${d.displayName} 복사본`, serviceKind: `${d.serviceKind}-copy`, isActive: false, defaultSections: norm(d.defaultSections.map((s) => ({ ...s, id: sid(s.sectionTypeCode ?? s.sectionType, `${s.title}-copy`) }))) });
const payload = (d: Draft) => ({ serviceKind: d.serviceKind.trim(), displayName: d.displayName.trim(), startTime: d.startTime.trim(), generationRule: d.generationRule, isActive: d.isActive, defaultSections: norm(d.defaultSections).map((s) => ({ id: s.id.trim(), order: s.order, sectionTypeCode: (s.sectionTypeCode ?? s.sectionType).trim(), title: s.title.trim(), detail: s.detail ?? "", role: s.role.trim(), assigneeName: null, durationMinutes: Number(s.durationMinutes ?? 0), dueOffsetMinutes: Number(s.dueOffsetMinutes ?? 0), inputTemplateId: s.inputTemplateId?.trim() ?? "", slideTemplateKey: s.slideTemplateKey?.trim() ?? "", workspaceBucket: s.workspaceBucket ?? "content", notes: s.notes.trim(), content: s.content ?? {} })) });

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-2 text-sm text-slate-700"><span className="font-medium text-slate-900">{label}</span>{children}</label>;
}

const applyType = (s: WorshipTemplateSectionPreset, t: WorshipSectionTypeDefinition): WorshipTemplateSectionPreset => {
  const nextSlide = s.slideTemplateKey?.trim() ? s.slideTemplateKey : t.defaultSlideTemplateKey || "";
  return {
    ...s,
    sectionTypeCode: t.code,
    sectionType: t.code,
    workspaceBucket: t.workspaceBucket,
    title: s.title.trim() ? s.title : t.defaultTitle || t.label,
    role: s.role.trim() ? s.role : t.defaultRole || "",
    durationMinutes: s.durationMinutes > 0 ? s.durationMinutes : t.defaultDurationMinutes ?? 0,
    dueOffsetMinutes: (s.dueOffsetMinutes ?? 0) > 0 ? s.dueOffsetMinutes ?? 0 : t.defaultDueOffsetMinutes ?? 0,
    inputTemplateId: s.inputTemplateId?.trim() ? s.inputTemplateId : t.defaultInputTemplateId || "",
    slideTemplateKey: nextSlide,
    templateKey: nextSlide,
  };
};

function Card({ s, selected, types, onSelect, onCopy, onDelete }: { s: WorshipTemplateSectionPreset; selected: boolean; types: WorshipSectionTypeDefinition[]; onSelect: () => void; onCopy: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: s.id });
  const label = types.find((t) => t.code === (s.sectionTypeCode ?? s.sectionType))?.label ?? (s.sectionTypeCode ?? s.sectionType);
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`rounded-xl border p-3 ${selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white"}`}><div className="flex gap-2"><button type="button" {...attributes} {...listeners} className="rounded border px-2 py-1 text-xs">이동</button><button type="button" onClick={onSelect} className="flex-1 text-left"><div className="text-xs opacity-70">{s.order}. {label}</div><div className="mt-1 font-semibold">{s.title}</div><div className="mt-1 text-sm opacity-80">{s.role || "미배정"}</div></button></div><div className="mt-3 flex gap-2"><button type="button" onClick={onCopy} className="rounded border px-2 py-1 text-xs">복사</button><button type="button" onClick={onDelete} className="rounded border px-2 py-1 text-xs">삭제</button></div></div>;
}

export default function AdminWorshipTemplatesPage() {
  const [templates, setTemplates] = useState<WorshipTemplate[]>([]);
  const [types, setTypes] = useState<WorshipSectionTypeDefinition[]>([]);
  const [inputs, setInputs] = useState<WorshipInputTemplate[]>([]);
  const [slides, setSlides] = useState<WorshipSlideTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(j(emptyDraft));
  const [baseline, setBaseline] = useState<Draft>(j(emptyDraft));
  const [tab, setTab] = useState<"meta" | "sections">("sections");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [liveSections, setLiveSections] = useState<WorshipTemplateSectionPreset[] | null>(null);
  const displaySections = liveSections ?? draft.defaultSections;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const typeMap = useMemo(() => new Map(types.map((t) => [t.code, t])), [types]);
  const selected = draft.defaultSections.find((s) => s.id === selectedSectionId) ?? null;
  const dirty = JSON.stringify(norm(draft.defaultSections)) !== JSON.stringify(norm(baseline.defaultSections)) || JSON.stringify({ ...draft, defaultSections: [] }) !== JSON.stringify({ ...baseline, defaultSections: [] });
  const pickTypes = (cur?: string) => types.filter((t) => t.isActive || t.code === cur);
  const pickInputs = (cur?: string) => inputs.filter((t) => t.isActive || t.id === cur);
  const pickSlides = (cur?: string) => slides.filter((t) => t.isActive || t.key === cur);
  const loadDraft = (next: Draft, nextId: string | null) => { const c = j(next); setSelectedTemplateId(nextId); setDraft(c); setBaseline(j(next)); setSelectedSectionId(c.defaultSections[0]?.id ?? null); setMessage(""); };
  const confirmDiscard = () => !dirty || window.confirm("저장하지 않은 변경 내용이 사라집니다.");

  useEffect(() => {
    void Promise.all([listWorshipTemplates(), listWorshipSectionTypes(), listWorshipInputTemplates(), listWorshipSlideTemplates()]).then(([tt, st, it, sl]) => {
      const rows = [...tt].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.displayName.localeCompare(b.displayName, "ko"));
      setTemplates(rows); setTypes([...st].sort((a, b) => a.sortOrder - b.sortOrder)); setInputs(it); setSlides(sl);
      if (rows[0]) loadDraft(fromTemplate(rows[0]), rows[0].id);
    }).catch((e: unknown) => setMessage(e instanceof Error ? e.message : "불러오기에 실패했습니다."));
  }, []);

  useEffect(() => { if (!draft.defaultSections.some((s) => s.id === selectedSectionId)) setSelectedSectionId(draft.defaultSections[0]?.id ?? null); }, [draft.defaultSections, selectedSectionId]);

  const setSection = (patch: Partial<WorshipTemplateSectionPreset>) => { if (!selected) return; setDraft(j({ ...draft, defaultSections: draft.defaultSections.map((s) => s.id === selected.id ? { ...s, ...patch } : s) })); };
  const addSection = () => { const t = types.find((x) => x.isActive) ?? types[0]; if (!t) return setMessage("먼저 순서 타입을 생성해 주세요."); const next = makeSection(t); setDraft(j({ ...draft, defaultSections: norm([...draft.defaultSections, next]) })); setSelectedSectionId(next.id); };
  const copySection = (id: string) => { const index = draft.defaultSections.findIndex((s) => s.id === id); if (index < 0) return; const src = draft.defaultSections[index]; const next = { ...j(src), id: `${sid(src.sectionTypeCode ?? src.sectionType, src.title)}-${Math.random().toString(36).slice(2, 8)}`, title: `${src.title} copy` }; const rows = [...draft.defaultSections]; rows.splice(index + 1, 0, next); setDraft(j({ ...draft, defaultSections: norm(rows) })); setSelectedSectionId(next.id); };
  const removeSection = (id: string) => { if (!window.confirm("이 순서를 삭제하시겠습니까?")) return; setDraft(j({ ...draft, defaultSections: norm(draft.defaultSections.filter((s) => s.id !== id)) })); };

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col gap-6 px-4 py-8">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">관리자 / 예배 템플릿</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">예배 템플릿 편집기</h1>
            <p className="mt-2 text-sm text-slate-600">메타와 순서 구성만 관리합니다.</p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => { if (!confirmDiscard()) return; loadDraft(j(emptyDraft), null); }} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">새 템플릿</button>
            <button type="button" onClick={() => { if (!confirmDiscard()) return; loadDraft(copyDraft(draft), null); setMessage("복사본이 만들어졌습니다."); }} className="rounded-full border px-4 py-2 text-sm font-semibold">복사</button>
            <button type="button" disabled={saving} onClick={async () => { try { setSaving(true); if (!draft.displayName.trim() || !draft.serviceKind.trim()) throw new Error("표시 이름과 서비스 종류를 입력해 주세요."); const saved = draft.id ? await updateWorshipTemplate(draft.id, payload(draft)) : await createWorshipTemplate(payload(draft)); const next = [...templates.filter((t) => t.id !== saved.id), saved].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.displayName.localeCompare(b.displayName, "ko")); setTemplates(next); loadDraft(fromTemplate(saved), saved.id); setMessage("저장했습니다."); } catch (e: unknown) { setMessage(e instanceof Error ? e.message : "저장에 실패했습니다."); } finally { setSaving(false); } }} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">{saving ? "저장 중" : "저장"}</button>
            {draft.id ? <button type="button" disabled={deleting} onClick={async () => { const id = draft.id; if (!id || !window.confirm("이 템플릿을 삭제하시겠습니까?")) return; try { setDeleting(true); await deleteWorshipTemplate(id); const next = templates.filter((t) => t.id !== id).sort((a, b) => a.startTime.localeCompare(b.startTime) || a.displayName.localeCompare(b.displayName, "ko")); setTemplates(next); loadDraft(next[0] ? fromTemplate(next[0]) : j(emptyDraft), next[0]?.id ?? null); setMessage("삭제했습니다."); } catch (e: unknown) { setMessage(e instanceof Error ? e.message : "삭제에 실패했습니다."); } finally { setDeleting(false); } }} className="rounded-full border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700">삭제</button> : null}
          </div>
        </div>
      </header>

      {message ? <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">{message}</div> : null}

      {/* 템플릿 목록 카드 */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex gap-3 overflow-x-auto pb-2">
          <button type="button" onClick={() => { if (!confirmDiscard()) return; loadDraft(j(emptyDraft), null); }} className={`min-w-[110px] rounded-3xl border px-4 py-4 text-left ${!selectedTemplateId ? "border-slate-900 bg-slate-900 text-white" : "border-dashed border-slate-300 bg-slate-50"}`}>새 항목</button>
          {templates.map((t) => (
            <div key={t.id} className={`min-w-[130px] rounded-3xl border px-4 py-4 ${selectedTemplateId === t.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white"}`}>
              <button type="button" onClick={() => { if (!confirmDiscard()) return; loadDraft(fromTemplate(t), t.id); }} className="w-full text-left">
                <div className="font-semibold">{t.displayName}</div>
                <div className="mt-1 text-xs opacity-70">{t.serviceKind} / {t.startTime}</div>
                <div className="mt-3 text-sm opacity-80">순서 {t.defaultSections.length}개</div>
              </button>
              <button type="button" onClick={() => { if (!confirmDiscard()) return; loadDraft(copyDraft(fromTemplate(t)), null); setMessage("복사본이 만들어졌습니다."); }} className="mt-3 rounded-full border px-3 py-1 text-xs">복사</button>
            </div>
          ))}
        </div>
      </section>

      {/* 편집기 */}
      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b px-6 py-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{selectedTemplateId ? "선택됨" : "새 항목"}</div>
              <div className="mt-2 text-2xl font-semibold">{draft.displayName || draft.serviceKind || "새 템플릿"}</div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setTab("meta")} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === "meta" ? "bg-slate-900 text-white" : "border bg-white"}`}>메타</button>
              <button type="button" onClick={() => setTab("sections")} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === "sections" ? "bg-slate-900 text-white" : "border bg-white"}`}>순서</button>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          {tab === "meta" ? (
            <section className="grid gap-4 xl:grid-cols-[1fr_320px]">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="서비스 종류"><input value={draft.serviceKind} onChange={(e) => setDraft(j({ ...draft, serviceKind: e.target.value }))} className="rounded-xl border px-3 py-2" /></Field>
                <Field label="표시 이름"><input value={draft.displayName} onChange={(e) => setDraft(j({ ...draft, displayName: e.target.value }))} className="rounded-xl border px-3 py-2" /></Field>
                <Field label="시작 시간"><input value={draft.startTime} onChange={(e) => setDraft(j({ ...draft, startTime: e.target.value }))} className="rounded-xl border px-3 py-2" /></Field>
                <Field label="생성 규칙"><select value={draft.generationRule} onChange={(e) => setDraft(j({ ...draft, generationRule: e.target.value as WorshipGenerationRule }))} className="rounded-xl border px-3 py-2">{rules.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></Field>
                <label className="flex items-center gap-3 rounded-xl border bg-slate-50 px-4 py-3 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft(j({ ...draft, isActive: e.target.checked }))} />활성화</label>
              </div>
              <aside className="rounded-3xl border bg-slate-50 p-5">
                <div className="font-semibold">전역 리소스</div>
                <div className="mt-4 grid gap-2">
                  <Link href="/admin/worship-section-types" className="rounded-xl border bg-white px-4 py-3 text-sm">순서 타입</Link>
                  <Link href="/admin/worship-input-templates" className="rounded-xl border bg-white px-4 py-3 text-sm">입력 템플릿</Link>
                  <Link href="/admin/worship-slide-templates" className="rounded-xl border bg-white px-4 py-3 text-sm">슬라이드 템플릿</Link>
                </div>
              </aside>
            </section>
          ) : (
            <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div className="font-semibold">순서 목록</div>
                  <button type="button" onClick={addSection} className="rounded-full border px-4 py-2 text-sm font-semibold">추가</button>
                </div>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(_e: DragStartEvent) => { setLiveSections(draft.defaultSections); }} onDragOver={(e: DragOverEvent) => { const { active, over } = e; if (!over || active.id === over.id) return; setLiveSections((prev) => { if (!prev) return prev; const oi = prev.findIndex((s) => s.id === active.id); const ni = prev.findIndex((s) => s.id === over.id); if (oi < 0 || ni < 0) return prev; return arrayMove(prev, oi, ni); }); }} onDragEnd={(_e: DragEndEvent) => { setLiveSections((prev) => { if (prev) setDraft((d) => j({ ...d, defaultSections: norm(prev) })); return null; }); }} onDragCancel={() => setLiveSections(null)}>
                  <SortableContext items={displaySections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="grid gap-3">
                      {displaySections.length
                        ? displaySections.map((s) => <Card key={s.id} s={s} types={types} selected={selectedSectionId === s.id} onSelect={() => setSelectedSectionId(s.id)} onCopy={() => copySection(s.id)} onDelete={() => removeSection(s.id)} />)
                        : <div className="rounded-2xl border border-dashed bg-slate-50 px-4 py-8 text-sm text-slate-500">순서가 없습니다.</div>}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>

              <div className="rounded-3xl border bg-slate-50 p-5">
                {selected ? (
                  <div className="grid gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">순서</div>
                        <div className="mt-2 text-xl font-semibold">{selected.title || selected.id}</div>
                        <div className="mt-2 text-sm text-slate-500">{selected.id} / {selected.workspaceBucket}</div>
                      </div>
                      <button type="button" onClick={() => copySection(selected.id)} className="rounded-full border px-4 py-2 text-sm font-semibold">복사</button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="순서 타입"><select value={selected.sectionTypeCode ?? selected.sectionType} onChange={(e) => { const t = typeMap.get(e.target.value); if (!t) return; setDraft(j({ ...draft, defaultSections: draft.defaultSections.map((s) => s.id === selected.id ? applyType(s, t) : s) })); }} className="rounded-xl border px-3 py-2">{pickTypes(selected.sectionTypeCode ?? selected.sectionType).map((t) => <option key={t.code} value={t.code}>{t.label}{t.isActive ? "" : " (비활성)"}</option>)}</select></Field>
                      <Field label="제목"><input value={selected.title} onChange={(e) => setSection({ title: e.target.value })} className="rounded-xl border px-3 py-2" /></Field>
                      <Field label="역할"><input value={selected.role} onChange={(e) => setSection({ role: e.target.value })} className="rounded-xl border px-3 py-2" /></Field>
                      <Field label="버킷"><input readOnly value={selected.workspaceBucket ?? "content"} className="rounded-xl border bg-slate-100 px-3 py-2 text-slate-500" /></Field>
                      <Field label="소요 시간(분)"><input type="number" min={0} value={selected.durationMinutes} onChange={(e) => setSection({ durationMinutes: Number(e.target.value || 0) })} className="rounded-xl border px-3 py-2" /></Field>
                      <Field label="마감 오프셋(분)"><input type="number" min={0} value={selected.dueOffsetMinutes ?? 0} onChange={(e) => setSection({ dueOffsetMinutes: Number(e.target.value || 0) })} className="rounded-xl border px-3 py-2" /></Field>
                      <Field label="입력 템플릿"><select value={selected.inputTemplateId ?? ""} onChange={(e) => setSection({ inputTemplateId: e.target.value })} className="rounded-xl border px-3 py-2">{pickInputs(selected.inputTemplateId).map((t) => <option key={t.id} value={t.id}>{t.label}{t.isActive ? "" : " (비활성)"}</option>)}</select></Field>
                      <Field label="슬라이드 템플릿"><select value={selected.slideTemplateKey ?? ""} onChange={(e) => setSection({ slideTemplateKey: e.target.value, templateKey: e.target.value })} className="rounded-xl border px-3 py-2"><option value="">없음</option>{pickSlides(selected.slideTemplateKey).map((t) => <option key={t.key} value={t.key}>{t.label}{t.isActive ? "" : " (비활성)"}</option>)}</select></Field>
                    </div>
                    <Field label="메모"><textarea value={selected.notes} onChange={(e) => setSection({ notes: e.target.value })} className="min-h-[120px] rounded-xl border px-3 py-2" /></Field>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed bg-white px-4 py-10 text-sm text-slate-500">순서를 선택하세요.</div>
                )}
              </div>
            </section>
          )}
        </div>
      </section>
    </section>
  );
}
