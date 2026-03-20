"use client";

import { useEffect, useState } from "react";

import { getApprovalTemplates, getBoards } from "@/lib/api";
import type { ApprovalTemplate, Board, DocumentTargetType } from "@/lib/types";
import { DocumentEditor } from "@/components/udms/document-editor";
import { useTargetCatalog } from "@/components/udms/use-target-catalog";

export type DocumentFormValues = {
  title: string;
  category: string;
  tagsText: string;
  targetType: DocumentTargetType;
  targetId: string;
  body: string;
  approvalTemplateId: string | null;
  changeLog: string;
};

type DocumentFormProps = {
  initialValues: DocumentFormValues;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (values: {
    title: string;
    category: string;
    tags: string[];
    targetType: DocumentTargetType;
    targetId: string;
    body: string;
    moduleData: Record<string, unknown>;
    changeLog?: string;
  }) => Promise<void>;
};

export function DocumentForm({ initialValues, submitLabel, busyLabel, onSubmit }: DocumentFormProps) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [templates, setTemplates] = useState<ApprovalTemplate[]>([]);
  const [values, setValues] = useState<DocumentFormValues>(initialValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const { enabledTargets, message: catalogMessage } = useTargetCatalog();

  useEffect(() => {
    async function load() {
      try {
        const [boardItems, templateItems] = await Promise.all([getBoards(), getApprovalTemplates()]);
        setBoards(boardItems);
        setTemplates(templateItems);
        setValues((current) => {
          if (current.targetType !== "Board") {
            return current;
          }

          const nextTargetId = current.targetId || boardItems[0]?.id || "";
          return nextTargetId === current.targetId ? current : { ...current, targetId: nextTargetId };
        });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to load document form data.");
      }
    }

    void load();
  }, []);

  useEffect(() => {
    if (!enabledTargets.length) {
      return;
    }

    setValues((current) => {
      const nextTargetType = enabledTargets.some((target) => target.targetType === current.targetType)
        ? current.targetType
        : enabledTargets[0]?.targetType ?? current.targetType;
      const nextTargetId = nextTargetType === "Board" ? current.targetId || boards[0]?.id || "" : current.targetId;
      const nextApprovalTemplateId = nextTargetType === "Approval" ? current.approvalTemplateId : null;

      if (
        nextTargetType === current.targetType &&
        nextTargetId === current.targetId &&
        nextApprovalTemplateId === current.approvalTemplateId
      ) {
        return current;
      }

      return {
        ...current,
        targetType: nextTargetType,
        targetId: nextTargetId,
        approvalTemplateId: nextApprovalTemplateId,
      };
    });
  }, [boards, enabledTargets]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    try {
      const moduleData =
        values.targetType === "Approval" && values.approvalTemplateId
          ? { approval: { templateId: values.approvalTemplateId } }
          : {};

      await onSubmit({
        title: values.title,
        category: values.category,
        tags: values.tagsText
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        targetType: values.targetType,
        targetId: values.targetId,
        body: values.body,
        moduleData,
        changeLog: values.changeLog || undefined,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save the document.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      {message || catalogMessage ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {message || catalogMessage}
        </div>
      ) : null}

      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-700">Title</span>
        <input
          value={values.title}
          onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}
          className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
          placeholder="Document title"
          required
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Category</span>
          <input
            value={values.category}
            onChange={(event) => setValues((current) => ({ ...current, category: event.target.value }))}
            className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
            placeholder="BoardPost, Report, Memo"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Tags</span>
          <input
            value={values.tagsText}
            onChange={(event) => setValues((current) => ({ ...current, tagsText: event.target.value }))}
            className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
            placeholder="notice, weekly, worship"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Target Type</span>
          <select
            value={values.targetType}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                targetType: event.target.value as DocumentTargetType,
                targetId: event.target.value === "Board" ? boards[0]?.id || "" : current.targetId,
                approvalTemplateId: event.target.value === "Approval" ? current.approvalTemplateId : null,
              }))
            }
            className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
          >
            {enabledTargets.map((target) => (
              <option key={target.targetType} value={target.targetType}>
                {target.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Target ID</span>
          {values.targetType === "Board" ? (
            <select
              value={values.targetId}
              onChange={(event) => setValues((current) => ({ ...current, targetId: event.target.value }))}
              className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
            >
              <option value="">Select a board</option>
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={values.targetId}
              onChange={(event) => setValues((current) => ({ ...current, targetId: event.target.value }))}
              className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
              placeholder="Parent entity id"
              required
            />
          )}
        </label>
      </div>

      {values.targetType === "Approval" ? (
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Approval Template</span>
          <select
            value={values.approvalTemplateId ?? ""}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                approvalTemplateId: event.target.value || null,
              }))
            }
            className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
          >
            <option value="">No template</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <DocumentEditor value={values.body} onChange={(body) => setValues((current) => ({ ...current, body }))} />

      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-700">Change Log</span>
        <input
          value={values.changeLog}
          onChange={(event) => setValues((current) => ({ ...current, changeLog: event.target.value }))}
          className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
          placeholder="Why this revision changed"
        />
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? busyLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
