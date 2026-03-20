"use client";

import type { DocumentRevision } from "@/lib/types";

type VersionBrowserProps = {
  revisions: DocumentRevision[];
  canRollback: boolean;
  onRollback: (version: number) => Promise<void>;
};

export function VersionBrowser({ revisions, canRollback, onRollback }: VersionBrowserProps) {
  return (
    <section className="panel rounded-[28px] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">History</p>
      <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900">Version Browser</h2>
      <div className="mt-4 grid gap-3">
        {revisions.map((revision) => (
          <div key={revision.id} className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  v{revision.version} {revision.isCurrent ? "/ current" : ""} {revision.isPublished ? "/ published" : ""}
                </p>
                <p className="mt-1 text-sm text-slate-600">{revision.summary}</p>
              </div>
              {canRollback ? (
                <button
                  type="button"
                  onClick={() => void onRollback(revision.version)}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Rollback
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
