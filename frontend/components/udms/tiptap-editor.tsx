"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import { useEffect } from "react";

type TipTapEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

export function TipTapEditor({ value, onChange }: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "min-h-[320px] prose prose-slate max-w-none rounded-[24px] border border-slate-200 bg-white px-5 py-4 outline-none",
      },
    },
    onUpdate({ editor: current }) {
      onChange(current.getHTML());
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    if (editor.getHTML() === value) {
      return;
    }
    editor.commands.setContent(value, false);
  }, [editor, value]);

  if (!editor) {
    return (
      <div className="min-h-[320px] rounded-[24px] border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">
        에디터를 불러오는 중입니다.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
        >
          Bold
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
        >
          List
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
        >
          Table
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
        >
          Redo
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
