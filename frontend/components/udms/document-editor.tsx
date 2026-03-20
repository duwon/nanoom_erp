"use client";

import { TipTapEditor } from "@/components/udms/tiptap-editor";

type DocumentEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

export function DocumentEditor({ value, onChange }: DocumentEditorProps) {
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium text-slate-700">Body</span>
      <TipTapEditor value={value} onChange={onChange} />
    </div>
  );
}
