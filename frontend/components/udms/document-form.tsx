"use client";

import { useEffect, useState } from "react";

import { getApprovalTemplates, getBoards } from "@/lib/api";
import type { ApprovalTemplate, Board } from "@/lib/types";
import { TipTapEditor } from "@/components/udms/tiptap-editor";

type DocumentFormValues = {
  boardId: string;
  title: string;
  content: string;
  approvalTemplateId: string | null;
};

type DocumentFormProps = {
  initialValues: DocumentFormValues;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (values: DocumentFormValues) => Promise<void>;
};

export function DocumentForm({
  initialValues,
  submitLabel,
  busyLabel,
  onSubmit,
}: DocumentFormProps) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [templates, setTemplates] = useState<ApprovalTemplate[]>([]);
  const [values, setValues] = useState<DocumentFormValues>(initialValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  useEffect(() => {
    async function load() {
      try {
        const [boardItems, templateItems] = await Promise.all([getBoards(), getApprovalTemplates()]);
        setBoards(boardItems);
        setTemplates(templateItems);
        setValues((current) => ({
          ...current,
          boardId: current.boardId || boardItems[0]?.id || "",
        }));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "문서 작성 데이터를 불러오지 못했습니다.");
      }
    }
    void load();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    try {
      await onSubmit(values);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "문서 저장에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      {message ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {message}
        </div>
      ) : null}

      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-700">제목</span>
        <input
          value={values.title}
          onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}
          className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
          placeholder="문서 제목"
          required
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">게시판</span>
          <select
            value={values.boardId}
            onChange={(event) => setValues((current) => ({ ...current, boardId: event.target.value }))}
            className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
          >
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">결재 템플릿</span>
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
            <option value="">선택 안 함</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-700">본문</span>
        <TipTapEditor
          value={values.content}
          onChange={(content) => setValues((current) => ({ ...current, content }))}
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
