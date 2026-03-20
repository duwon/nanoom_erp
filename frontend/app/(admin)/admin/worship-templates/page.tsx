"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useState, type ReactNode } from "react";

import {
  createWorshipTemplate,
  deleteWorshipTemplate,
  listWorshipTemplates,
  updateWorshipTemplate,
} from "@/lib/api";
import type {
  WorshipFieldType,
  WorshipGenerationRule,
  WorshipSectionType,
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
  defaultSections: WorshipTemplateSectionPreset[];
  taskPresets: WorshipTaskPreset[];
  templatePresets: WorshipTemplatePreset[];
};

type TabKey = "meta" | "sections" | "tasks" | "slides" | "advanced";

type AdvancedEditors = {
  defaultSectionsJson: string;
  taskPresetsJson: string;
  templatePresetsJson: string;
};

const generationRuleOptions: Array<{ value: WorshipGenerationRule; label: string }> = [
  { value: "daily", label: "매일" },
  { value: "sunday", label: "주일" },
  { value: "wednesday", label: "수요" },
  { value: "friday", label: "금요" },
];

const sectionTypeOptions: Array<{ value: WorshipSectionType; label: string }> = [
  { value: "song", label: "찬양" },
  { value: "special_song", label: "특송" },
  { value: "scripture", label: "성경" },
  { value: "message", label: "말씀" },
  { value: "notice", label: "공지" },
  { value: "prayer", label: "기도" },
  { value: "media", label: "미디어" },
];

const fieldTypeOptions: Array<{ value: WorshipFieldType; label: string }> = [
  { value: "text", label: "한 줄 텍스트" },
  { value: "textarea", label: "긴 텍스트" },
  { value: "song_search", label: "찬양 검색" },
  { value: "lyrics", label: "가사" },
  { value: "scripture", label: "성경 본문" },
  { value: "template", label: "슬라이드 템플릿" },
];

const tabOptions: Array<{ key: TabKey; label: string }> = [
  { key: "meta", label: "기본 정보" },
  { key: "sections", label: "예배 순서" },
  { key: "tasks", label: "담당 작업" },
  { key: "slides", label: "슬라이드 템플릿" },
  { key: "advanced", label: "고급 설정" },
];

const emptyDraft: DraftTemplate = {
  serviceKind: "",
  displayName: "",
  startTime: "09:00",
  generationRule: "sunday",
  isActive: true,
  defaultSections: [],
  taskPresets: [],
  templatePresets: [],
};

function cloneDraft(draft: DraftTemplate): DraftTemplate {
  return JSON.parse(JSON.stringify(draft)) as DraftTemplate;
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function buildAdvancedEditors(draft: DraftTemplate): AdvancedEditors {
  return {
    defaultSectionsJson: formatJson(draft.defaultSections),
    taskPresetsJson: formatJson(draft.taskPresets),
    templatePresetsJson: formatJson(draft.templatePresets),
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function randomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSectionId(sectionType: WorshipSectionType, title: string) {
  const slug = slugify(`${sectionType}-${title}`);
  return slug || randomId(`section-${sectionType}`);
}

function createTaskId(role: string, scope: string) {
  const slug = slugify(`${role}-${scope}`);
  return slug ? `task-${slug}` : randomId("task");
}

function createTemplateKey(label: string) {
  const slug = slugify(label);
  return slug || randomId("template");
}

function normalizeSectionOrders(sections: WorshipTemplateSectionPreset[]) {
  return sections.map((section, index) => ({ ...section, order: index + 1 }));
}

function createEmptySection(sectionType: WorshipSectionType): WorshipTemplateSectionPreset {
  const title = sectionTypeOptions.find((item) => item.value === sectionType)?.label ?? "새 순서";
  return {
    id: createSectionId(sectionType, title),
    order: 1,
    sectionType,
    title,
    detail: "",
    role: "",
    assigneeName: null,
    durationMinutes: 0,
    templateKey: "",
    notes: "",
    content: {},
  };
}

function createEmptyTaskPreset(): WorshipTaskPreset {
  return {
    id: createTaskId("task", "preset"),
    role: "",
    scope: "",
    sectionIds: [],
    requiredFields: [],
    dueOffsetMinutes: 0,
    tips: "",
  };
}

function createEmptyTemplatePreset(): WorshipTemplatePreset {
  return { key: createTemplateKey("새 템플릿"), label: "새 템플릿", description: "" };
}

function toDraft(template: WorshipTemplate): DraftTemplate {
  return {
    id: template.id,
    serviceKind: template.serviceKind,
    displayName: template.displayName,
    startTime: template.startTime,
    generationRule: template.generationRule,
    isActive: template.isActive,
    defaultSections: normalizeSectionOrders(template.defaultSections),
    taskPresets: template.taskPresets.map((task) => ({ ...task })),
    templatePresets: template.templatePresets.map((preset) => ({ ...preset })),
  };
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

function serializeDraft(draft: DraftTemplate) {
  return JSON.stringify({ ...draft, defaultSections: normalizeSectionOrders(draft.defaultSections) });
}

function validateDraft(draft: DraftTemplate) {
  if (!draft.displayName.trim()) throw new Error("템플릿 이름을 입력해 주세요.");
  if (!draft.serviceKind.trim()) throw new Error("serviceKind를 입력해 주세요.");
  if (!/^\d{2}:\d{2}$/.test(draft.startTime.trim())) throw new Error("예배 시간은 HH:MM 형식이어야 합니다.");

  const sectionIds = new Set<string>();
  for (const section of draft.defaultSections) {
    if (!section.id.trim()) throw new Error("예배 순서 ID는 비어 있을 수 없습니다.");
    if (sectionIds.has(section.id)) throw new Error(`중복된 예배 순서 ID가 있습니다: ${section.id}`);
    sectionIds.add(section.id);
    if (!section.title.trim()) throw new Error("예배 순서 제목을 입력해 주세요.");
  }

  const taskIds = new Set<string>();
  for (const task of draft.taskPresets) {
    if (!task.id.trim()) throw new Error("담당 작업 ID는 비어 있을 수 없습니다.");
    if (taskIds.has(task.id)) throw new Error(`중복된 담당 작업 ID가 있습니다: ${task.id}`);
    taskIds.add(task.id);
    if (!task.role.trim()) throw new Error("담당 작업 역할을 입력해 주세요.");
    for (const sectionId of task.sectionIds) {
      if (!sectionIds.has(sectionId)) throw new Error(`존재하지 않는 예배 순서가 연결되어 있습니다: ${sectionId}`);
    }
  }

  const templateKeys = new Set<string>();
  for (const preset of draft.templatePresets) {
    if (!preset.key.trim()) throw new Error("슬라이드 템플릿 key는 비어 있을 수 없습니다.");
    if (templateKeys.has(preset.key)) throw new Error(`중복된 슬라이드 템플릿 key가 있습니다: ${preset.key}`);
    templateKeys.add(preset.key);
  }

  for (const section of draft.defaultSections) {
    if (section.templateKey && !templateKeys.has(section.templateKey)) {
      throw new Error(`예배 순서에서 사용하는 템플릿이 존재하지 않습니다: ${section.templateKey}`);
    }
  }
}

function buildPayload(draft: DraftTemplate) {
  return {
    serviceKind: draft.serviceKind.trim(),
    displayName: draft.displayName.trim(),
    startTime: draft.startTime.trim(),
    generationRule: draft.generationRule,
    defaultSections: normalizeSectionOrders(draft.defaultSections).map((section) => ({
      ...section,
      id: section.id.trim(),
      title: section.title.trim(),
      detail: section.detail.trim(),
      role: section.role.trim(),
      assigneeName: section.assigneeName?.trim() ? section.assigneeName.trim() : null,
      templateKey: section.templateKey.trim(),
      notes: section.notes.trim(),
    })),
    taskPresets: draft.taskPresets.map((task) => ({
      ...task,
      id: task.id.trim(),
      role: task.role.trim(),
      scope: task.scope.trim(),
      tips: task.tips.trim(),
      requiredFields: task.requiredFields.map((field) => ({
        ...field,
        key: field.key.trim(),
        label: field.label.trim(),
        helpText: field.helpText.trim(),
      })),
    })),
    templatePresets: draft.templatePresets.map((preset) => ({
      ...preset,
      key: preset.key.trim(),
      label: preset.label.trim(),
      description: preset.description.trim(),
    })),
    isActive: draft.isActive,
  };
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm text-slate-700">
      <span className="font-medium text-slate-900">{label}</span>
      {children}
    </label>
  );
}

function SortableSectionCard({
  section,
  isSelected,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  section: WorshipTemplateSectionPreset;
  isSelected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-[22px] border px-4 py-4 ${
        isSelected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className={`mt-1 rounded-full border px-3 py-2 text-xs font-semibold ${
            isSelected ? "border-white/30 bg-white/10 text-white" : "border-slate-200 bg-slate-50 text-slate-500"
          }`}
        >
          drag
        </button>
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isSelected ? "bg-white/15" : "bg-slate-100 text-slate-600"}`}>
              {section.order}
            </span>
            <span className={`text-xs font-semibold uppercase tracking-[0.18em] ${isSelected ? "text-white/75" : "text-slate-500"}`}>
              {sectionTypeOptions.find((option) => option.value === section.sectionType)?.label ?? section.sectionType}
            </span>
          </div>
          <p className="mt-2 truncate text-base font-semibold">{section.title}</p>
          <p className={`mt-2 text-sm ${isSelected ? "text-white/80" : "text-slate-600"}`}>
            {section.role || "담당 미지정"} · {section.durationMinutes}분 · {section.templateKey || "템플릿 없음"}
          </p>
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onSelect} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${isSelected ? "bg-white text-slate-900" : "border border-slate-200 bg-white text-slate-700"}`}>편집</button>
        <button type="button" onClick={onDuplicate} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${isSelected ? "bg-white/10 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>복제</button>
        <button type="button" onClick={onDelete} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${isSelected ? "bg-rose-500 text-white" : "border border-rose-200 bg-rose-50 text-rose-700"}`}>삭제</button>
      </div>
    </div>
  );
}

export default function AdminWorshipTemplatesPage() {
  const [templates, setTemplates] = useState<WorshipTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftTemplate>(cloneDraft(emptyDraft));
  const [baselineDraft, setBaselineDraft] = useState<DraftTemplate>(cloneDraft(emptyDraft));
  const [advancedEditors, setAdvancedEditors] = useState<AdvancedEditors>(buildAdvancedEditors(emptyDraft));
  const [activeTab, setActiveTab] = useState<TabKey>("sections");
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedSlideKey, setSelectedSlideKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isDirty = serializeDraft(draft) !== serializeDraft(baselineDraft);
  const selectedSection = draft.defaultSections.find((section) => section.id === selectedSectionId) ?? null;
  const selectedTask = draft.taskPresets.find((task) => task.id === selectedTaskId) ?? null;
  const selectedSlide = draft.templatePresets.find((preset) => preset.key === selectedSlideKey) ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    async function load() {
      try {
        const nextTemplates = sortTemplates(await listWorshipTemplates());
        setTemplates(nextTemplates);
        if (nextTemplates[0]) {
          const nextDraft = toDraft(nextTemplates[0]);
          setSelectedTemplateId(nextTemplates[0].id);
          setDraft(cloneDraft(nextDraft));
          setBaselineDraft(cloneDraft(nextDraft));
          setAdvancedEditors(buildAdvancedEditors(nextDraft));
          setSelectedSectionId(nextDraft.defaultSections[0]?.id ?? null);
          setSelectedTaskId(nextDraft.taskPresets[0]?.id ?? null);
          setSelectedSlideKey(nextDraft.templatePresets[0]?.key ?? null);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "예배 템플릿을 불러오지 못했습니다.");
      }
    }
    void load();
  }, []);

  useEffect(() => {
    if (!draft.defaultSections.some((section) => section.id === selectedSectionId)) setSelectedSectionId(draft.defaultSections[0]?.id ?? null);
  }, [draft.defaultSections, selectedSectionId]);

  useEffect(() => {
    if (!draft.taskPresets.some((task) => task.id === selectedTaskId)) setSelectedTaskId(draft.taskPresets[0]?.id ?? null);
  }, [draft.taskPresets, selectedTaskId]);

  useEffect(() => {
    if (!draft.templatePresets.some((preset) => preset.key === selectedSlideKey)) setSelectedSlideKey(draft.templatePresets[0]?.key ?? null);
  }, [draft.templatePresets, selectedSlideKey]);

  function loadDraft(nextDraft: DraftTemplate, nextTemplateId: string | null) {
    const cloned = cloneDraft(nextDraft);
    setSelectedTemplateId(nextTemplateId);
    setDraft(cloned);
    setBaselineDraft(cloneDraft(nextDraft));
    setAdvancedEditors(buildAdvancedEditors(cloned));
    setSelectedSectionId(cloned.defaultSections[0]?.id ?? null);
    setSelectedTaskId(cloned.taskPresets[0]?.id ?? null);
    setSelectedSlideKey(cloned.templatePresets[0]?.key ?? null);
    setMessage("");
  }

  function confirmDiscardChanges() {
    return !isDirty || window.confirm("저장하지 않은 변경사항이 있습니다. 이동하면 현재 수정 내용이 사라집니다.");
  }

  function applyDraft(nextDraft: DraftTemplate) {
    setDraft(cloneDraft(nextDraft));
  }

  function updateSelectedSection(changes: Partial<WorshipTemplateSectionPreset>) {
    if (!selectedSectionId) return;
    applyDraft({ ...draft, defaultSections: draft.defaultSections.map((section) => (section.id === selectedSectionId ? { ...section, ...changes } : section)) });
  }

  function updateSelectedTask(changes: Partial<WorshipTaskPreset>) {
    if (!selectedTaskId) return;
    applyDraft({ ...draft, taskPresets: draft.taskPresets.map((task) => (task.id === selectedTaskId ? { ...task, ...changes } : task)) });
  }

  function updateSelectedSlide(changes: Partial<WorshipTemplatePreset>) {
    if (!selectedSlideKey) return;
    applyDraft({ ...draft, templatePresets: draft.templatePresets.map((preset) => (preset.key === selectedSlideKey ? { ...preset, ...changes } : preset)) });
  }

  async function handleSaveDraft() {
    try {
      setIsSaving(true);
      setMessage("");
      validateDraft(draft);
      const saved = draft.id ? await updateWorshipTemplate(draft.id, buildPayload(draft)) : await createWorshipTemplate(buildPayload(draft));
      const nextTemplates = sortTemplates([...templates.filter((item) => item.id !== saved.id), saved]);
      setTemplates(nextTemplates);
      loadDraft(toDraft(saved), saved.id);
      setMessage("예배 템플릿을 저장했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "예배 템플릿 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteTemplate() {
    if (!draft.id) return;
    if (!window.confirm(`'${draft.displayName || draft.serviceKind}' 템플릿을 삭제할까요? 이미 생성된 예배 서비스는 유지됩니다.`)) return;
    try {
      setIsDeleting(true);
      await deleteWorshipTemplate(draft.id);
      const nextTemplates = sortTemplates(templates.filter((template) => template.id !== draft.id));
      setTemplates(nextTemplates);
      loadDraft(nextTemplates[0] ? toDraft(nextTemplates[0]) : cloneDraft(emptyDraft), nextTemplates[0]?.id ?? null);
      setMessage("예배 템플릿을 삭제했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "예배 템플릿 삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  }

  function handleSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = draft.defaultSections.findIndex((section) => section.id === active.id);
    const newIndex = draft.defaultSections.findIndex((section) => section.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    applyDraft({ ...draft, defaultSections: normalizeSectionOrders(arrayMove(draft.defaultSections, oldIndex, newIndex)) });
  }

  function handleSelectTemplate(template: WorshipTemplate) {
    if (template.id === selectedTemplateId) return;
    if (!confirmDiscardChanges()) return;
    loadDraft(toDraft(template), template.id);
  }

  function handleCreateNewTemplate() {
    if (!confirmDiscardChanges()) return;
    loadDraft(cloneDraft(emptyDraft), null);
  }

  function handleResetDraft() {
    loadDraft(cloneDraft(baselineDraft), selectedTemplateId);
  }

  function handleAddSection(sectionType: WorshipSectionType) {
    const nextSection = createEmptySection(sectionType);
    applyDraft({ ...draft, defaultSections: normalizeSectionOrders([...draft.defaultSections, nextSection]) });
    setSelectedSectionId(nextSection.id);
    setActiveTab("sections");
  }

  function handleDuplicateSection(sectionId: string) {
    const index = draft.defaultSections.findIndex((section) => section.id === sectionId);
    if (index < 0) return;
    const source = draft.defaultSections[index];
    const duplicated = { ...source, id: createSectionId(source.sectionType, `${source.title}-copy`), title: `${source.title} 복사본` };
    const nextSections = [...draft.defaultSections];
    nextSections.splice(index + 1, 0, duplicated);
    applyDraft({ ...draft, defaultSections: normalizeSectionOrders(nextSections) });
    setSelectedSectionId(duplicated.id);
  }

  function handleDeleteSection(sectionId: string) {
    const target = draft.defaultSections.find((section) => section.id === sectionId);
    if (!target) return;
    if (!window.confirm(`'${target.title}' 순서를 삭제할까요? 연결된 담당 작업도 정리됩니다.`)) return;
    applyDraft({
      ...draft,
      defaultSections: normalizeSectionOrders(draft.defaultSections.filter((section) => section.id !== sectionId)),
      taskPresets: draft.taskPresets
        .map((task) => ({ ...task, sectionIds: task.sectionIds.filter((id) => id !== sectionId) }))
        .filter((task) => task.sectionIds.length > 0),
    });
  }

  function handleAddTaskPreset() {
    const nextTask = createEmptyTaskPreset();
    applyDraft({ ...draft, taskPresets: [...draft.taskPresets, nextTask] });
    setSelectedTaskId(nextTask.id);
    setActiveTab("tasks");
  }

  function handleDeleteTaskPreset(taskId: string) {
    const target = draft.taskPresets.find((task) => task.id === taskId);
    if (!target) return;
    if (!window.confirm(`'${target.role || target.id}' 담당 작업을 삭제할까요?`)) return;
    applyDraft({ ...draft, taskPresets: draft.taskPresets.filter((task) => task.id !== taskId) });
  }

  function handleAddRequiredField() {
    if (!selectedTask) return;
    updateSelectedTask({
      requiredFields: [
        ...selectedTask.requiredFields,
        { key: randomId("field"), label: "새 필드", fieldType: "text", required: true, helpText: "" },
      ],
    });
  }

  function moveRequiredField(index: number, direction: -1 | 1) {
    if (!selectedTask) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= selectedTask.requiredFields.length) return;
    updateSelectedTask({ requiredFields: arrayMove(selectedTask.requiredFields, index, nextIndex) });
  }

  function handleAddTemplatePreset() {
    const nextPreset = createEmptyTemplatePreset();
    applyDraft({ ...draft, templatePresets: [...draft.templatePresets, nextPreset] });
    setSelectedSlideKey(nextPreset.key);
    setActiveTab("slides");
  }

  function handleDeleteTemplatePreset(templateKey: string) {
    const usedBySection = draft.defaultSections.find((section) => section.templateKey === templateKey);
    if (usedBySection) {
      setMessage(`'${templateKey}' 템플릿은 '${usedBySection.title}' 순서에서 사용 중입니다. 먼저 다른 템플릿으로 바꿔 주세요.`);
      return;
    }
    const target = draft.templatePresets.find((preset) => preset.key === templateKey);
    if (!target) return;
    if (!window.confirm(`'${target.label}' 슬라이드 템플릿을 삭제할까요?`)) return;
    applyDraft({ ...draft, templatePresets: draft.templatePresets.filter((preset) => preset.key !== templateKey) });
  }

  function handleRefreshAdvancedEditors() {
    setAdvancedEditors(buildAdvancedEditors(draft));
  }

  function handleApplyAdvancedEditors() {
    try {
      const nextDraft: DraftTemplate = {
        ...draft,
        defaultSections: normalizeSectionOrders(parseJsonArray<WorshipTemplateSectionPreset>("기본 순서", advancedEditors.defaultSectionsJson)),
        taskPresets: parseJsonArray<WorshipTaskPreset>("담당 작업", advancedEditors.taskPresetsJson),
        templatePresets: parseJsonArray<WorshipTemplatePreset>("슬라이드 템플릿", advancedEditors.templatePresetsJson),
      };
      applyDraft(nextDraft);
      setMessage("고급 설정 JSON을 폼 상태에 반영했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "고급 설정 JSON을 적용하지 못했습니다.");
    }
  }

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-6 px-4 py-8 md:px-6 lg:px-8">
      <header className="rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(226,232,240,0.9),_rgba(255,255,255,1)_45%,_rgba(248,250,252,1)_100%)] px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Admin / Worship Templates</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">예배 템플릿 편집기</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              JSON 대신 폼과 카드 중심으로 예배 순서, 담당 작업, 슬라이드 템플릿을 편집합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">전체 {templates.length}개</div>
            <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">활성 {templates.filter((template) => template.isActive).length}개</div>
            <button type="button" onClick={handleCreateNewTemplate} className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
              새 템플릿
            </button>
          </div>
        </div>
      </header>

      {message ? <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">{message}</div> : null}

      <section className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">템플릿 목록</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">상단에서 템플릿을 선택하고 아래에서 수정하세요.</h2>
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={handleCreateNewTemplate}
            className={`min-w-[220px] rounded-[24px] border px-4 py-4 text-left ${!selectedTemplateId ? "border-slate-900 bg-slate-900 text-white" : "border-dashed border-slate-300 bg-slate-50 text-slate-700"}`}
          >
            <p className="text-sm font-semibold">새 템플릿 초안</p>
            <p className={`mt-2 text-sm ${!selectedTemplateId ? "text-white/80" : "text-slate-500"}`}>비어 있는 템플릿부터 시작합니다.</p>
          </button>
          {templates.map((template) => {
            const isSelected = template.id === selectedTemplateId;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => handleSelectTemplate(template)}
                className={`min-w-[260px] rounded-[24px] border px-4 py-4 text-left ${isSelected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{template.displayName}</p>
                    <p className={`mt-1 text-xs uppercase tracking-[0.2em] ${isSelected ? "text-white/70" : "text-slate-500"}`}>{template.serviceKind} / {template.startTime}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${template.isActive ? isSelected ? "bg-white/15 text-white" : "bg-emerald-100 text-emerald-700" : isSelected ? "bg-white/10 text-white/75" : "bg-slate-100 text-slate-500"}`}>
                    {template.isActive ? "활성" : "비활성"}
                  </span>
                </div>
                <p className={`mt-4 text-sm ${isSelected ? "text-white/80" : "text-slate-600"}`}>
                  순서 {template.defaultSections.length}개 · 작업 {template.taskPresets.length}개 · 슬라이드 {template.templatePresets.length}개
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{selectedTemplateId ? "선택된 템플릿" : "새 템플릿"}</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">{draft.displayName || draft.serviceKind || "새 템플릿"}</h2>
              <p className="mt-2 text-sm text-slate-600">{draft.id ? `템플릿 ID: ${draft.id}` : "아직 저장되지 않은 초안입니다."}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setDraft((current) => ({ ...current, isActive: !current.isActive }))} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                {draft.isActive ? "비활성으로 전환" : "활성으로 전환"}
              </button>
              <button type="button" onClick={handleResetDraft} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">초기화</button>
              {draft.id ? (
                <button type="button" onClick={() => void handleDeleteTemplate()} disabled={isDeleting} className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {isDeleting ? "삭제 중..." : "삭제"}
                </button>
              ) : null}
              <button type="button" onClick={() => void handleSaveDraft()} disabled={isSaving} className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                {isSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {tabOptions.map((tab) => (
              <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === tab.key ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>
                {tab.label}
              </button>
            ))}
            {isDirty ? <span className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">저장되지 않은 변경사항</span> : null}
          </div>
        </div>

        <div className="px-6 py-6">
          {activeTab === "meta" ? (
            <section className="grid gap-4 lg:grid-cols-2">
              <DetailField label="템플릿 이름">
                <input value={draft.displayName} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} className="rounded-[18px] border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400" placeholder="주일 1부 예배" />
              </DetailField>
              <DetailField label="serviceKind">
                <input value={draft.serviceKind} onChange={(event) => setDraft((current) => ({ ...current, serviceKind: event.target.value }))} className="rounded-[18px] border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400" placeholder="sunday1" />
              </DetailField>
              <DetailField label="예배 시간">
                <input value={draft.startTime} onChange={(event) => setDraft((current) => ({ ...current, startTime: event.target.value }))} className="rounded-[18px] border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400" placeholder="09:00" />
              </DetailField>
              <DetailField label="생성 규칙">
                <select value={draft.generationRule} onChange={(event) => setDraft((current) => ({ ...current, generationRule: event.target.value as WorshipGenerationRule }))} className="rounded-[18px] border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400">
                  {generationRuleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </DetailField>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">활성 상태</p>
                <label className="mt-3 flex items-center gap-3">
                  <input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))} />
                  자동 생성 가능한 템플릿으로 사용
                </label>
              </div>
            </section>
          ) : null}

          {activeTab === "sections" ? (
            <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-5">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-900">빠른 추가</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {sectionTypeOptions.map((option) => (
                      <button key={option.value} type="button" onClick={() => handleAddSection(option.value)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {draft.defaultSections.length ? (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
                    <SortableContext items={draft.defaultSections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
                      <div className="grid gap-3">
                        {draft.defaultSections.map((section) => (
                          <SortableSectionCard key={section.id} section={section} isSelected={section.id === selectedSectionId} onSelect={() => setSelectedSectionId(section.id)} onDuplicate={() => handleDuplicateSection(section.id)} onDelete={() => handleDeleteSection(section.id)} />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : (
                  <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-sm text-slate-500">아직 등록된 예배 순서가 없습니다.</div>
                )}
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-5">
                {selectedSection ? (
                  <div className="grid gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">예배 순서 상세</p>
                      <h3 className="mt-2 text-xl font-semibold text-slate-900">{selectedSection.title}</h3>
                      <p className="mt-2 text-sm text-slate-500">ID는 고급 설정에서만 수정할 수 있습니다: {selectedSection.id}</p>
                    </div>
                    <DetailField label="제목"><input value={selectedSection.title} onChange={(event) => updateSelectedSection({ title: event.target.value })} className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" /></DetailField>
                    <DetailField label="순서 타입">
                      <select value={selectedSection.sectionType} onChange={(event) => updateSelectedSection({ sectionType: event.target.value as WorshipSectionType })} className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400">
                        {sectionTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </DetailField>
                    <DetailField label="설명"><input value={selectedSection.detail} onChange={(event) => updateSelectedSection({ detail: event.target.value })} className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" /></DetailField>
                    <div className="grid gap-4 md:grid-cols-2">
                      <DetailField label="담당 역할"><input value={selectedSection.role} onChange={(event) => updateSelectedSection({ role: event.target.value })} className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" /></DetailField>
                      <DetailField label="담당자 이름"><input value={selectedSection.assigneeName ?? ""} onChange={(event) => updateSelectedSection({ assigneeName: event.target.value || null })} className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" /></DetailField>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <DetailField label="소요 시간 (분)"><input type="number" min={0} value={selectedSection.durationMinutes} onChange={(event) => updateSelectedSection({ durationMinutes: Number(event.target.value || 0) })} className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" /></DetailField>
                      <DetailField label="슬라이드 템플릿">
                        <select value={selectedSection.templateKey} onChange={(event) => updateSelectedSection({ templateKey: event.target.value })} className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400">
                          <option value="">템플릿 없음</option>
                          {draft.templatePresets.map((preset) => <option key={preset.key} value={preset.key}>{preset.label} ({preset.key})</option>)}
                        </select>
                      </DetailField>
                    </div>
                    <DetailField label="메모"><textarea value={selectedSection.notes} onChange={(event) => updateSelectedSection({ notes: event.target.value })} className="min-h-[140px] rounded-[18px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" /></DetailField>
                  </div>
                ) : <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-5 py-10 text-sm text-slate-500">편집할 예배 순서를 선택해 주세요.</div>}
              </div>
            </section>
          ) : null}

          {activeTab === "tasks" ? (
            <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">담당 작업</p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-900">작업 프리셋 카드</h3>
                  </div>
                  <button type="button" onClick={handleAddTaskPreset} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">작업 추가</button>
                </div>
                {draft.taskPresets.length ? (
                  <div className="grid gap-3">
                    {draft.taskPresets.map((task) => (
                      <button key={task.id} type="button" onClick={() => setSelectedTaskId(task.id)} className={`rounded-[22px] border px-4 py-4 text-left ${task.id === selectedTaskId ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{task.role || "역할 미입력"}</p>
                            <p className={`mt-1 text-sm ${task.id === selectedTaskId ? "text-white/75" : "text-slate-500"}`}>{task.scope || "설명 없음"}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${task.id === selectedTaskId ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600"}`}>{task.dueOffsetMinutes}분 전</span>
                        </div>
                        <p className={`mt-3 text-sm ${task.id === selectedTaskId ? "text-white/80" : "text-slate-600"}`}>연결 순서 {task.sectionIds.length}개 · 필수 필드 {task.requiredFields.length}개</p>
                      </button>
                    ))}
                  </div>
                ) : <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-sm text-slate-500">아직 등록된 담당 작업이 없습니다.</div>}
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-5">
                {selectedTask ? (
                  <div className="grid gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">작업 상세</p>
                        <h3 className="mt-2 text-xl font-semibold text-slate-900">{selectedTask.role || selectedTask.id}</h3>
                        <p className="mt-2 text-sm text-slate-500">ID는 고급 설정에서만 수정할 수 있습니다: {selectedTask.id}</p>
                      </div>
                      <button type="button" onClick={() => handleDeleteTaskPreset(selectedTask.id)} className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">삭제</button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <DetailField label="담당 역할"><input value={selectedTask.role} onChange={(event) => updateSelectedTask({ role: event.target.value })} className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" /></DetailField>
                      <DetailField label="작업 범위"><input value={selectedTask.scope} onChange={(event) => updateSelectedTask({ scope: event.target.value })} className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" /></DetailField>
                    </div>
                    <DetailField label="마감 오프셋 (분)"><input type="number" value={selectedTask.dueOffsetMinutes} onChange={(event) => updateSelectedTask({ dueOffsetMinutes: Number(event.target.value || 0) })} className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" /></DetailField>
                    <DetailField label="안내 문구"><textarea value={selectedTask.tips} onChange={(event) => updateSelectedTask({ tips: event.target.value })} className="min-h-[120px] rounded-[18px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" /></DetailField>
                    <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4">
                      <p className="text-sm font-semibold text-slate-900">연결된 예배 순서</p>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {draft.defaultSections.map((section) => (
                          <label key={section.id} className="flex items-center gap-3 rounded-[16px] border border-slate-200 px-3 py-3 text-sm text-slate-700">
                            <input type="checkbox" checked={selectedTask.sectionIds.includes(section.id)} onChange={(event) => updateSelectedTask({ sectionIds: event.target.checked ? [...selectedTask.sectionIds, section.id] : selectedTask.sectionIds.filter((id) => id !== section.id) })} />
                            <span>{section.title}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">필수 입력 필드</p>
                        <button type="button" onClick={handleAddRequiredField} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">필드 추가</button>
                      </div>
                      <div className="mt-4 grid gap-3">
                        {selectedTask.requiredFields.length ? selectedTask.requiredFields.map((field, index) => (
                          <div key={`${field.key}-${index}`} className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4">
                            <div className="grid gap-3 md:grid-cols-2">
                              <DetailField label="key"><input value={field.key} onChange={(event) => updateSelectedTask({ requiredFields: selectedTask.requiredFields.map((item, itemIndex) => itemIndex === index ? { ...item, key: event.target.value } : item) })} className="rounded-[16px] border border-slate-200 bg-white px-3 py-2.5 outline-none transition focus:border-slate-400" /></DetailField>
                              <DetailField label="label"><input value={field.label} onChange={(event) => updateSelectedTask({ requiredFields: selectedTask.requiredFields.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) })} className="rounded-[16px] border border-slate-200 bg-white px-3 py-2.5 outline-none transition focus:border-slate-400" /></DetailField>
                            </div>
                            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                              <DetailField label="fieldType">
                                <select value={field.fieldType} onChange={(event) => updateSelectedTask({ requiredFields: selectedTask.requiredFields.map((item, itemIndex) => itemIndex === index ? { ...item, fieldType: event.target.value as WorshipFieldType } : item) })} className="rounded-[16px] border border-slate-200 bg-white px-3 py-2.5 outline-none transition focus:border-slate-400">
                                  {fieldTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                              </DetailField>
                              <label className="flex items-end gap-2 text-sm text-slate-700">
                                <input type="checkbox" checked={field.required} onChange={(event) => updateSelectedTask({ requiredFields: selectedTask.requiredFields.map((item, itemIndex) => itemIndex === index ? { ...item, required: event.target.checked } : item) })} />
                                필수
                              </label>
                            </div>
                            <DetailField label="helpText"><input value={field.helpText} onChange={(event) => updateSelectedTask({ requiredFields: selectedTask.requiredFields.map((item, itemIndex) => itemIndex === index ? { ...item, helpText: event.target.value } : item) })} className="rounded-[16px] border border-slate-200 bg-white px-3 py-2.5 outline-none transition focus:border-slate-400" /></DetailField>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button type="button" onClick={() => moveRequiredField(index, -1)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">위로</button>
                              <button type="button" onClick={() => moveRequiredField(index, 1)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">아래로</button>
                              <button type="button" onClick={() => updateSelectedTask({ requiredFields: selectedTask.requiredFields.filter((_, itemIndex) => itemIndex !== index) })} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">삭제</button>
                            </div>
                          </div>
                        )) : <div className="rounded-[18px] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">필수 입력 필드가 없습니다.</div>}
                      </div>
                    </div>
                  </div>
                ) : <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-5 py-10 text-sm text-slate-500">편집할 담당 작업을 선택해 주세요.</div>}
              </div>
            </section>
          ) : null}

          {activeTab === "slides" ? (
            <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">슬라이드 템플릿</p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-900">템플릿 카드 목록</h3>
                  </div>
                  <button type="button" onClick={handleAddTemplatePreset} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">템플릿 추가</button>
                </div>
                {draft.templatePresets.length ? (
                  <div className="grid gap-3">
                    {draft.templatePresets.map((preset) => (
                      <button key={preset.key} type="button" onClick={() => setSelectedSlideKey(preset.key)} className={`rounded-[22px] border px-4 py-4 text-left ${preset.key === selectedSlideKey ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"}`}>
                        <p className="text-sm font-semibold">{preset.label}</p>
                        <p className={`mt-1 text-xs uppercase tracking-[0.2em] ${preset.key === selectedSlideKey ? "text-white/70" : "text-slate-500"}`}>{preset.key}</p>
                        <p className={`mt-3 text-sm ${preset.key === selectedSlideKey ? "text-white/80" : "text-slate-600"}`}>{preset.description || "설명 없음"}</p>
                      </button>
                    ))}
                  </div>
                ) : <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-sm text-slate-500">등록된 슬라이드 템플릿이 없습니다.</div>}
              </div>
              <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-5">
                {selectedSlide ? (
                  <div className="grid gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">슬라이드 템플릿 상세</p>
                        <h3 className="mt-2 text-xl font-semibold text-slate-900">{selectedSlide.label}</h3>
                        <p className="mt-2 text-sm text-slate-500">key는 자동 생성되며 고급 설정에서만 수정할 수 있습니다: {selectedSlide.key}</p>
                      </div>
                      <button type="button" onClick={() => handleDeleteTemplatePreset(selectedSlide.key)} className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">삭제</button>
                    </div>
                    <DetailField label="표시 이름"><input value={selectedSlide.label} onChange={(event) => updateSelectedSlide({ label: event.target.value })} className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" /></DetailField>
                    <DetailField label="설명"><textarea value={selectedSlide.description} onChange={(event) => updateSelectedSlide({ description: event.target.value })} className="min-h-[160px] rounded-[18px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400" /></DetailField>
                    <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
                      <p className="font-semibold text-slate-900">현재 사용 중인 순서</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {draft.defaultSections.filter((section) => section.templateKey === selectedSlide.key).length ? draft.defaultSections.filter((section) => section.templateKey === selectedSlide.key).map((section) => <span key={section.id} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">{section.title}</span>) : <span className="text-sm text-slate-500">아직 사용하는 순서가 없습니다.</span>}
                      </div>
                    </div>
                  </div>
                ) : <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-5 py-10 text-sm text-slate-500">편집할 슬라이드 템플릿을 선택해 주세요.</div>}
              </div>
            </section>
          ) : null}

          {activeTab === "advanced" ? (
            <section className="grid gap-4">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleRefreshAdvancedEditors} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">현재 폼 상태 불러오기</button>
                <button type="button" onClick={handleApplyAdvancedEditors} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">JSON 적용</button>
              </div>
              <details open className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
                <summary className="cursor-pointer text-sm font-semibold text-slate-900">기본 순서 JSON</summary>
                <textarea value={advancedEditors.defaultSectionsJson} onChange={(event) => setAdvancedEditors((current) => ({ ...current, defaultSectionsJson: event.target.value }))} className="mt-4 min-h-[260px] w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 font-mono text-sm outline-none transition focus:border-slate-400" />
              </details>
              <details className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
                <summary className="cursor-pointer text-sm font-semibold text-slate-900">담당 작업 JSON</summary>
                <textarea value={advancedEditors.taskPresetsJson} onChange={(event) => setAdvancedEditors((current) => ({ ...current, taskPresetsJson: event.target.value }))} className="mt-4 min-h-[260px] w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 font-mono text-sm outline-none transition focus:border-slate-400" />
              </details>
              <details className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
                <summary className="cursor-pointer text-sm font-semibold text-slate-900">슬라이드 템플릿 JSON</summary>
                <textarea value={advancedEditors.templatePresetsJson} onChange={(event) => setAdvancedEditors((current) => ({ ...current, templatePresetsJson: event.target.value }))} className="mt-4 min-h-[220px] w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 font-mono text-sm outline-none transition focus:border-slate-400" />
              </details>
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-5 py-5 text-sm leading-7 text-slate-600">예외적인 content 구조, 내부 ID, key 수동 수정은 이 고급 설정에서만 처리합니다.</div>
            </section>
          ) : null}
        </div>
      </section>
    </section>
  );
}
