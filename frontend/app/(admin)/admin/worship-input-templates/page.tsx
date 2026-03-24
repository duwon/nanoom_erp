"use client";

import { useEffect, useState } from "react";

import {
  createWorshipInputTemplate,
  deleteWorshipInputTemplate,
  listWorshipInputTemplates,
  updateWorshipInputTemplate,
} from "@/lib/api";
import type {
  WorshipFieldType,
  WorshipInputTemplate,
  WorshipTaskFieldSpec,
} from "@/lib/types";

const FIELD_TYPES: { value: WorshipFieldType; label: string; hint: string }[] = [
  { value: "title",       label: "제목",          hint: "section.title에 저장, 한 줄 텍스트" },
  { value: "song_search", label: "곡 검색",        hint: "section.title에 저장, 곡 검색 UI" },
  { value: "detail",      label: "설명",           hint: "section.detail에 저장, 여러 줄 텍스트" },
  { value: "notes",       label: "메모",           hint: "section.notes에 저장, 여러 줄 텍스트" },
  { value: "lyrics",      label: "가사",           hint: "슬라이드 자동 생성, content에 저장" },
  { value: "scripture",   label: "성경 구절",      hint: "성경 조회 + 슬라이드 생성, section.detail에도 저장" },
  { value: "textarea",    label: "자유 텍스트",    hint: "content에만 저장, 여러 줄 텍스트" },
];

function generateKey(): string {
  return `f${Date.now().toString(36)}`;
}

const emptyField = (): WorshipTaskFieldSpec => ({
  key: generateKey(),
  label: "",
  fieldType: "title",
  required: false,
  helpText: "",
});

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
  const [fields, setFields] = useState<WorshipTaskFieldSpec[]>([]);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [fieldsJson, setFieldsJson] = useState("[]");
  const [jsonError, setJsonError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const nextItems = await listWorshipInputTemplates();
    setItems(nextItems);
    const first = nextItems[0];
    if (first && !selectedId) {
      applyItem(first);
    }
  }

  function applyItem(item: WorshipInputTemplate) {
    setSelectedId(item.id);
    setDraft({ ...item });
    setFields(item.fields);
    setFieldsJson(JSON.stringify(item.fields, null, 2));
    setMessage("");
    setJsonError("");
  }

  useEffect(() => {
    void load().catch((error: unknown) =>
      setMessage(error instanceof Error ? error.message : "불러오기에 실패했습니다.")
    );
  }, []);

  function selectItem(item: WorshipInputTemplate) {
    applyItem(item);
    setAdvancedMode(false);
  }

  function handleNewTemplate() {
    setSelectedId(null);
    setDraft(emptyDraft);
    setFields([]);
    setFieldsJson("[]");
    setAdvancedMode(false);
    setMessage("");
    setJsonError("");
  }

  function toggleAdvanced() {
    if (!advancedMode) {
      // 폼 → JSON
      setFieldsJson(JSON.stringify(fields, null, 2));
      setJsonError("");
    } else {
      // JSON → 폼
      try {
        const parsed = JSON.parse(fieldsJson) as WorshipTaskFieldSpec[];
        setFields(parsed);
        setJsonError("");
      } catch {
        setJsonError("JSON 파싱에 실패했습니다. 형식을 확인해 주세요.");
        return;
      }
    }
    setAdvancedMode((v) => !v);
  }

  function resolveFields(): WorshipTaskFieldSpec[] | null {
    if (advancedMode) {
      try {
        return JSON.parse(fieldsJson) as WorshipTaskFieldSpec[];
      } catch {
        setJsonError("JSON 파싱에 실패했습니다. 형식을 확인해 주세요.");
        return null;
      }
    }
    return fields;
  }

  async function handleSave() {
    const resolvedFields = resolveFields();
    if (resolvedFields === null) return;
    try {
      const payload = { ...draft, fields: resolvedFields };
      const saved = selectedId
        ? await updateWorshipInputTemplate(selectedId, payload)
        : await createWorshipInputTemplate(payload);
      await load();
      applyItem(saved);
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
      setFields([]);
      setFieldsJson("[]");
      await load();
      setMessage("삭제했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    }
  }

  function updateField(index: number, patch: Partial<WorshipTaskFieldSpec>) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  function moveField(index: number, direction: -1 | 1) {
    const next = [...fields];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setFields(next);
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* 사이드바 */}
      <aside className="space-y-3">
        <button
          type="button"
          onClick={handleNewTemplate}
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
        >
          새 입력 템플릿
        </button>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectItem(item)}
            className={`w-full rounded-xl border px-4 py-3 text-left ${
              selectedId === item.id
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="text-sm font-semibold">{item.label}</div>
            <div className="mt-1 text-xs opacity-70">
              {item.id} · 필드 {item.fields.length} · 사용 {item.usageCount}
            </div>
          </button>
        ))}
      </aside>

      {/* 편집 영역 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        {/* 기본 메타 */}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm">
            <span>ID</span>
            <input
              value={draft.id}
              onChange={(e) => setDraft({ ...draft, id: e.target.value })}
              className="rounded-lg border px-3 py-2"
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span>이름</span>
            <input
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              className="rounded-lg border px-3 py-2"
            />
          </label>
        </div>
        <label className="mt-4 grid gap-2 text-sm">
          <span>설명</span>
          <input
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            className="rounded-lg border px-3 py-2"
          />
        </label>
        <label className="mt-4 grid gap-2 text-sm">
          <span>안내 문구</span>
          <textarea
            value={draft.tips}
            onChange={(e) => setDraft({ ...draft, tips: e.target.value })}
            className="min-h-20 rounded-lg border px-3 py-2"
          />
        </label>

        {/* 필드 섹션 */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">
              입력 필드 {!advancedMode && <span className="font-normal text-slate-400">({fields.length}개)</span>}
            </span>
            <button
              type="button"
              onClick={toggleAdvanced}
              className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-500 hover:bg-slate-50"
            >
              {advancedMode ? "← 폼으로 보기" : "고급 (JSON 편집)"}
            </button>
          </div>

          {advancedMode ? (
            <div className="mt-3">
              <textarea
                value={fieldsJson}
                onChange={(e) => { setFieldsJson(e.target.value); setJsonError(""); }}
                className="w-full min-h-72 rounded-lg border px-3 py-2 font-mono text-xs"
              />
              {jsonError ? <p className="mt-1 text-xs text-rose-600">{jsonError}</p> : null}
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {fields.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
                  필드가 없습니다. 아래에서 추가하세요.
                </p>
              )}
              {fields.map((field, index) => (
                <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  {/* 필드 헤더 */}
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">필드 {index + 1}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveField(index, -1)}
                        disabled={index === 0}
                        className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-200 disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveField(index, 1)}
                        disabled={index === fields.length - 1}
                        className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-200 disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeField(index)}
                        className="ml-1 rounded px-1.5 py-0.5 text-xs text-rose-400 hover:bg-rose-50"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  {/* 필드 폼 */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs">
                      <span className="text-slate-500">표시 이름</span>
                      <input
                        value={field.label}
                        onChange={(e) => updateField(index, { label: e.target.value })}
                        placeholder="예: 제목, 가사"
                        className="rounded-lg border bg-white px-3 py-1.5"
                      />
                    </label>
                    <label className="grid gap-1 text-xs">
                      <span className="text-slate-500">필드 타입</span>
                      <select
                        value={field.fieldType}
                        onChange={(e) => updateField(index, { fieldType: e.target.value as WorshipFieldType })}
                        className="rounded-lg border bg-white px-3 py-1.5"
                      >
                        {FIELD_TYPES.map((ft) => (
                          <option key={ft.value} value={ft.value}>{ft.label}</option>
                        ))}
                      </select>
                    </label>
                    {FIELD_TYPES.find((ft) => ft.value === field.fieldType)?.hint ? (
                      <p className="text-xs text-slate-400 sm:col-span-2">
                        {FIELD_TYPES.find((ft) => ft.value === field.fieldType)?.hint}
                      </p>
                    ) : null}
                    <label className="grid gap-1 text-xs sm:col-span-2">
                      <span className="text-slate-500">도움말</span>
                      <input
                        value={field.helpText}
                        onChange={(e) => updateField(index, { helpText: e.target.value })}
                        placeholder="입력자에게 보여주는 안내"
                        className="rounded-lg border bg-white px-3 py-1.5"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateField(index, { required: e.target.checked })}
                      />
                      <span className="text-slate-600">필수 입력</span>
                    </label>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setFields((prev) => [...prev, emptyField()])}
                className="w-full rounded-xl border border-dashed border-slate-300 py-2.5 text-sm text-slate-500 hover:bg-slate-50"
              >
                + 필드 추가
              </button>
            </div>
          )}
        </div>

        {/* 활성화 + 액션 */}
        <label className="mt-6 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.isActive}
            onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
          />
          활성화
        </label>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => void handleSave()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            저장
          </button>
          {selectedId ? (
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
            >
              삭제
            </button>
          ) : null}
        </div>
        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
      </section>
    </section>
  );
}
