"use client";

import { useEffect, useState } from "react";

import { ModulePage } from "@/components/module-page";
import {
  createWorshipTemplate,
  listWorshipTemplates,
  updateWorshipTemplate,
} from "@/lib/api";
import type {
  WorshipGenerationRule,
  WorshipTaskPreset,
  WorshipTemplate,
  WorshipTemplatePreset,
  WorshipTemplateSectionPreset,
} from "@/lib/types";

type DraftTemplate = {
  id?: string;
  serviceKind: string;
  displayName: string;
  startTime: string;
  generationRule: WorshipGenerationRule;
  isActive: boolean;
  defaultSectionsJson: string;
  taskPresetsJson: string;
  templatePresetsJson: string;
};

const generationRuleOptions: Array<{ value: WorshipGenerationRule; label: string }> = [
  { value: "daily", label: "매일" },
  { value: "sunday", label: "주일" },
  { value: "wednesday", label: "수요일" },
  { value: "friday", label: "금요일" },
];

const emptyDraft: DraftTemplate = {
  serviceKind: "",
  displayName: "",
  startTime: "09:00",
  generationRule: "sunday",
  isActive: true,
  defaultSectionsJson: "[]",
  taskPresetsJson: "[]",
  templatePresetsJson: "[]",
};

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function toDraft(template: WorshipTemplate): DraftTemplate {
  return {
    id: template.id,
    serviceKind: template.serviceKind,
    displayName: template.displayName,
    startTime: template.startTime,
    generationRule: template.generationRule,
    isActive: template.isActive,
    defaultSectionsJson: formatJson(template.defaultSections),
    taskPresetsJson: formatJson(template.taskPresets),
    templatePresetsJson: formatJson(template.templatePresets),
  };
}

function parseJsonArray<T>(label: string, value: string): T[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${label} JSON 형식이 올바르지 않습니다.`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${label}은 배열이어야 합니다.`);
  }
  return parsed as T[];
}

function sortTemplates(templates: WorshipTemplate[]) {
  return [...templates].sort((left, right) => {
    const timeCompare = left.startTime.localeCompare(right.startTime);
    if (timeCompare !== 0) {
      return timeCompare;
    }
    return left.displayName.localeCompare(right.displayName, "ko");
  });
}

export default function AdminWorshipTemplatesPage() {
  const [templates, setTemplates] = useState<WorshipTemplate[]>([]);
  const [draft, setDraft] = useState<DraftTemplate>(emptyDraft);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const nextTemplates = sortTemplates(await listWorshipTemplates());
        setTemplates(nextTemplates);
        if (nextTemplates[0]) {
          setDraft(toDraft(nextTemplates[0]));
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "예배 템플릿을 불러오지 못했습니다.");
      }
    }
    void load();
  }, []);

  async function saveDraft() {
    try {
      setIsSaving(true);
      setMessage("");
      const payload = {
        serviceKind: draft.serviceKind.trim(),
        displayName: draft.displayName.trim(),
        startTime: draft.startTime.trim(),
        generationRule: draft.generationRule,
        defaultSections: parseJsonArray<WorshipTemplateSectionPreset>("기본 순서", draft.defaultSectionsJson),
        taskPresets: parseJsonArray<WorshipTaskPreset>("담당자 작업", draft.taskPresetsJson),
        templatePresets: parseJsonArray<WorshipTemplatePreset>("슬라이드 템플릿", draft.templatePresetsJson),
        isActive: draft.isActive,
      };
      const saved = draft.id
        ? await updateWorshipTemplate(draft.id, payload)
        : await createWorshipTemplate(payload);
      const nextTemplates = sortTemplates([...templates.filter((item) => item.id !== saved.id), saved]);
      setTemplates(nextTemplates);
      setDraft(toDraft(saved));
      setMessage("예배 템플릿을 저장했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "예배 템플릿 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModulePage
      eyebrow="관리자 / 예배"
      title="예배 템플릿"
      description="서비스 생성 규칙, 기본 순서, 담당자 입력 프리셋을 템플릿 단위로 관리합니다. 여기서 저장한 값이 /worship 캘린더의 자동 생성 기준이 됩니다."
      highlights={[
        `${templates.length}개 템플릿`,
        `${templates.filter((template) => template.isActive).length}개 활성 템플릿`,
        "예배 서비스 aggregate 자동 생성 기준",
      ]}
      actions={[
        { href: "/worship", label: "예배 대시보드", variant: "secondary" },
        { href: "/admin", label: "관리자 홈", variant: "secondary" },
      ]}
    >
      {message ? (
        <div className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <section className="panel rounded-[28px] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              템플릿 편집
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900">
              {draft.id ? "템플릿 수정" : "템플릿 추가"}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setDraft(emptyDraft)}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            새 템플릿
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <input
            value={draft.displayName}
            onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
            placeholder="표시 이름"
            className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
          />
          <input
            value={draft.serviceKind}
            onChange={(event) => setDraft((current) => ({ ...current, serviceKind: event.target.value }))}
            placeholder="serviceKind 예: sunday_1st"
            className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
          />
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={draft.startTime}
              onChange={(event) => setDraft((current) => ({ ...current, startTime: event.target.value }))}
              placeholder="09:00"
              className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
            />
            <select
              value={draft.generationRule}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  generationRule: event.target.value as WorshipGenerationRule,
                }))
              }
              className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
            >
              {generationRuleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))}
            />
            활성 템플릿
          </label>

          <textarea
            value={draft.defaultSectionsJson}
            onChange={(event) =>
              setDraft((current) => ({ ...current, defaultSectionsJson: event.target.value }))
            }
            placeholder="기본 순서 JSON"
            className="min-h-[200px] rounded-[20px] border border-slate-200 bg-white px-4 py-3 font-mono text-sm outline-none transition focus:border-amber-400"
          />
          <textarea
            value={draft.taskPresetsJson}
            onChange={(event) =>
              setDraft((current) => ({ ...current, taskPresetsJson: event.target.value }))
            }
            placeholder="담당자 작업 JSON"
            className="min-h-[200px] rounded-[20px] border border-slate-200 bg-white px-4 py-3 font-mono text-sm outline-none transition focus:border-amber-400"
          />
          <textarea
            value={draft.templatePresetsJson}
            onChange={(event) =>
              setDraft((current) => ({ ...current, templatePresetsJson: event.target.value }))
            }
            placeholder="슬라이드 템플릿 JSON"
            className="min-h-[160px] rounded-[20px] border border-slate-200 bg-white px-4 py-3 font-mono text-sm outline-none transition focus:border-amber-400"
          />

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void saveDraft()}
              disabled={isSaving}
              className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "저장 중..." : "저장"}
            </button>
            <button
              type="button"
              onClick={() => setDraft(emptyDraft)}
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900"
            >
              초기화
            </button>
          </div>
        </div>
      </section>

      <section className="panel rounded-[28px] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          템플릿 목록
        </p>
        <div className="mt-4 grid gap-3">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => setDraft(toDraft(template))}
              className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{template.displayName}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">
                    {template.serviceKind} / {template.startTime}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    template.isActive
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {template.isActive ? "활성" : "비활성"}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                기본 순서 {template.defaultSections.length}개 / 담당자 작업 {template.taskPresets.length}개 / 템플릿 {template.templatePresets.length}개
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
        JSON 편집 필드는 서버 스키마와 동일한 배열 구조를 사용합니다. 기본 seed를 수정할 때는 `id`, `order`, `sectionType`, `requiredFields`, `dueOffsetMinutes` 필드를 유지하는 쪽이 안전합니다.
      </section>
    </ModulePage>
  );
}
