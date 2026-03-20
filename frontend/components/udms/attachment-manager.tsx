"use client";

import type { DocumentAttachment } from "@/lib/types";

type AttachmentManagerProps = {
  attachments: DocumentAttachment[];
  canEdit: boolean;
  onUpload: (file: File) => Promise<void>;
  onDelete: (attachmentId: string) => Promise<void>;
  getDownloadUrl: (attachmentId: string) => string;
};

export function AttachmentManager({
  attachments,
  canEdit,
  onUpload,
  onDelete,
  getDownloadUrl,
}: AttachmentManagerProps) {
  return (
    <section className="panel rounded-[28px] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Files</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900">Attachments</h2>
        </div>
        {canEdit ? (
          <label className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900">
            Upload File
            <input
              type="file"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void onUpload(file);
                  event.target.value = "";
                }
              }}
            />
          </label>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3">
        {attachments.length ? (
          attachments.map((attachment) => (
            <div key={attachment.id} className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{attachment.fileName}</p>
                  <p className="text-sm text-slate-600">
                    v{attachment.version} / {Math.max(1, Math.round(attachment.sizeBytes / 1024))} KB
                  </p>
                </div>

                <div className="flex gap-2">
                  <a
                    href={getDownloadUrl(attachment.id)}
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    Download
                  </a>
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => void onDelete(attachment.id)}
                      className="rounded-full border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[20px] border border-dashed border-slate-300 bg-white/70 px-4 py-4 text-sm text-slate-600">
            No attachments yet.
          </div>
        )}
      </div>
    </section>
  );
}
