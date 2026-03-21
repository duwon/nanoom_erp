"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useRef, useState } from "react";

import {
  addWorshipSection,
  deleteWorshipSection,
  issueWorshipGuestLink,
  listActiveUsers,
  updateWorshipSection,
} from "@/lib/api";
import type { ActiveUserSummary, WorshipSection, WorshipTaskFieldSpec } from "@/lib/types";
import { buildWorshipHref, buildWorshipSectionEditorHref, findNewSiblingSection } from "@/components/worship/navigation";
import { WorshipTaskForm } from "@/components/worship/task-form";
import { useWorshipContext } from "@/components/worship/use-worship-context";
import { WorshipWorkspaceShell, getWorshipStatusLabel, getWorshipStatusTheme } from "@/components/worship/workspace-shell";

function normalizeFieldBinding(field: WorshipTaskFieldSpec) {
  return field.binding ?? "value";
}

function buildInitialDraft(section: WorshipSection, fields: WorshipTaskFieldSpec[], taskValues?: Record<string, unknown>) {
  const draft: Record<string, unknown> = {};
  const source = taskValues ?? section.content ?? {};

  for (const field of fields) {
    const binding = normalizeFieldBinding(field);
    if (source[field.key] != null) {
      draft[field.key] = source[field.key];
      continue;
    }
    if (binding === "title") {
      draft[field.key] = section.title ?? "";
      continue;
    }
    if (binding === "detail") {
      draft[field.key] = section.detail ?? "";
      continue;
    }
    if (binding === "notes") {
      draft[field.key] = section.notes ?? "";
      continue;
    }
    if (binding === "slideTemplateKey") {
      draft[field.key] = section.slideTemplateKey ?? section.templateKey ?? "";
      continue;
    }
    draft[field.key] = section.content?.[field.key] ?? "";
  }

  return draft;
}

export default function WorshipSectionEditorPage({
  params,
}: {
  params: Promise<{ sectionId: string }>;
}) {
  const { sectionId } = use(params);
  const router = useRouter();
  const context = useWorshipContext();
  const service = context.service;
  const section = useMemo(
    () => service?.sections.find((candidate) => candidate.id === sectionId) ?? null,
    [sectionId, service],
  );
  const task = useMemo(
    () => service?.tasks.find((candidate) => candidate.sectionId === sectionId) ?? null,
    [sectionId, service],
  );

  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [assignOptions, setAssignOptions] = useState<ActiveUserSummary[]>([]);
  const savedSnapshotRef = useRef("");

  useEffect(() => {
    if (!section || !task) {
      return;
    }
    const nextDraft = buildInitialDraft(section, task.requiredFields, task.values);
    setDraft(nextDraft);
    savedSnapshotRef.current = JSON.stringify(nextDraft);
  }, [section, task]);

  useEffect(() => {
    if (!section?.capabilities.canAssign) {
      return;
    }
    void listActiveUsers()
      .then(setAssignOptions)
      .catch(() => setAssignOptions([]));
  }, [section?.capabilities.canAssign]);

  useEffect(() => {
    if (!service || !section || !section.capabilities.canEdit) {
      return;
    }
    const nextSnapshot = JSON.stringify(draft);
    if (!nextSnapshot || nextSnapshot === savedSnapshotRef.current) {
      return;
    }
    const timer = window.setTimeout(async () => {
      setSaving(true);
      try {
        const nextService = await updateWorshipSection(service.id, section.id, {
          version: service.version,
          editorValues: draft,
          markComplete: false,
        });
        savedSnapshotRef.current = nextSnapshot;
        context.setService(nextService);
        setMessage("자동 저장됨");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "자동 저장에 실패했습니다.");
      } finally {
        setSaving(false);
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [context, draft, section, service]);

  async function saveComplete() {
    if (!service || !section) {
      return;
    }
    setSaving(true);
    try {
      const nextService = await updateWorshipSection(service.id, section.id, {
        version: service.version,
        editorValues: draft,
        markComplete: true,
      });
      savedSnapshotRef.current = JSON.stringify(draft);
      context.setService(nextService);
      setMessage("입력 완료로 변경했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "완료 처리에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (!section || !task || !service) {
    return (
      <WorshipWorkspaceShell context={context} title="섹션 편집" description="선택한 예배 순서를 편집합니다.">
        <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          섹션을 찾을 수 없습니다.
        </div>
      </WorshipWorkspaceShell>
    );
  }

  return (
    <WorshipWorkspaceShell
      context={context}
      title={section.title}
      description="예배 순서 입력, 담당자 지정, 공유 링크 발급을 이 화면에서 처리합니다."
    >
      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="panel rounded-[24px] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {section.order}. {section.sectionTypeCode}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">{section.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{section.assigneeName || section.role || "담당 미지정"}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getWorshipStatusTheme(section.status)}`}>
              {getWorshipStatusLabel(section.status)}
            </span>
          </div>

          <div className="mt-4 grid gap-3">
            {section.capabilities.canAssign ? (
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">담당자</span>
                <select
                  value={section.assigneeId ?? ""}
                  onChange={async (event) => {
                    const assigneeId = event.target.value || null;
                    const assignee = assignOptions.find((candidate) => candidate.id === assigneeId) ?? null;
                    setSavingAssignment(true);
                    try {
                      const nextService = await updateWorshipSection(service.id, section.id, {
                        version: service.version,
                        assigneeId,
                        assigneeName: assignee?.name ?? null,
                      });
                      context.setService(nextService);
                      setMessage("담당자를 저장했습니다.");
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : "담당자 저장에 실패했습니다.");
                    } finally {
                      setSavingAssignment(false);
                    }
                  }}
                  className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-emerald-400"
                >
                  <option value="">미지정</option>
                  {assignOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {(item.name || item.id) + (item.department ? ` / ${item.department}` : "")}
                    </option>
                  ))}
                </select>
                {savingAssignment ? <span className="text-xs text-slate-500">저장 중...</span> : null}
              </label>
            ) : null}

            <WorshipTaskForm
              fields={task.requiredFields}
              values={draft}
              onChange={(key, value) => setDraft((current) => ({ ...current, [key]: value }))}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {section.capabilities.canShare ? (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const response = await issueWorshipGuestLink(service.id, task.id);
                    await navigator.clipboard.writeText(response.inputUrl);
                    await context.refreshService(service.id);
                    setMessage(`공유 링크를 복사했습니다: ${response.inputUrl}`);
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "공유 링크 발급에 실패했습니다.");
                  }
                }}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                공유 링크 발급
              </button>
            ) : null}

            {section.capabilities.canAddSiblingSong && section.workspaceBucket === "music" ? (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const nextService = await addWorshipSection(service.id, {
                      version: service.version,
                      afterSectionId: section.id,
                      sectionTypeCode: section.sectionTypeCode,
                    });
                    context.setService(nextService);
                    const nextSection = findNewSiblingSection(nextService, section.id, section.sectionTypeCode);
                    if (!nextSection) {
                      setMessage("다음 음악 순서를 찾지 못했습니다.");
                      return;
                    }
                    router.push(buildWorshipSectionEditorHref(nextSection.id, context.anchorDate, nextService.id));
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "음악 순서 추가에 실패했습니다.");
                  }
                }}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                곡 추가
              </button>
            ) : null}

            {section.capabilities.canRemove && section.workspaceBucket === "music" ? (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await deleteWorshipSection(service.id, section.id, service.version);
                    window.location.href = buildWorshipHref("/worship/songs", context.anchorDate, context.serviceId);
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "곡 삭제에 실패했습니다.");
                  }
                }}
                className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
              >
                곡 삭제
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => void saveComplete()}
              disabled={saving}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              {saving ? "저장 중..." : "입력 완료"}
            </button>
          </div>

          {message ? (
            <div className="mt-4 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {message}
            </div>
          ) : null}

          <div className="mt-4">
            <Link
              href={buildWorshipHref("/worship/assignees", context.anchorDate, context.serviceId)}
              className="text-sm font-medium text-emerald-700"
            >
              작업 목록으로 돌아가기
            </Link>
          </div>
        </article>

        <article className="panel rounded-[24px] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">미리보기</p>
          <div className="mt-4 rounded-[24px] bg-slate-950 px-5 py-5 text-white">
            <p className="text-sm font-medium text-emerald-300">{section.title}</p>
            <div className="mt-4 grid gap-3">
              {section.slides.length ? (
                section.slides.map((slide) => (
                  <div key={slide.id} className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{slide.label}</p>
                    <p className="mt-2 whitespace-pre-wrap text-lg leading-8">{slide.lines.join("\n")}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-[18px] border border-dashed border-white/10 px-4 py-8 text-sm text-slate-400">
                  저장하면 슬라이드 미리보기가 여기에 표시됩니다.
                </div>
              )}
            </div>
          </div>
        </article>
      </section>
    </WorshipWorkspaceShell>
  );
}
