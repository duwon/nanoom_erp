"use client";

import { useState } from "react";

import type { ExternalShareLink } from "@/lib/types";

type ExternalShareManagerProps = {
  links: ExternalShareLink[];
  canManage: boolean;
  onCreate: (payload: { label: string; expiresAt?: string | null; canDownload: boolean }) => Promise<void>;
  onDelete: (shareId: string) => Promise<void>;
};

export function ExternalShareManager({
  links,
  canManage,
  onCreate,
  onDelete,
}: ExternalShareManagerProps) {
  const [label, setLabel] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [canDownload, setCanDownload] = useState(true);

  return (
    <section className="panel rounded-[28px] p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">External</p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900">External Share Links</h2>
      </div>

      {canManage ? (
        <div className="mt-4 grid gap-3 rounded-[20px] border border-slate-200 bg-white px-4 py-4">
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Share label"
            className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
          />
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
          />
          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input type="checkbox" checked={canDownload} onChange={(event) => setCanDownload(event.target.checked)} />
            Allow download
          </label>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={async () => {
                await onCreate({ label, expiresAt: expiresAt || null, canDownload });
                setLabel("");
                setExpiresAt("");
                setCanDownload(true);
              }}
              className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
            >
              Create Share Link
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        {links.length ? (
          links.map((link) => (
            <div key={link.id} className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{link.label}</p>
                  <p className="mt-1 break-all text-sm text-slate-600">
                    token: {link.token} {link.expiresAt ? `/ expires ${link.expiresAt}` : ""}
                  </p>
                </div>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => void onDelete(link.id)}
                    className="rounded-full border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[20px] border border-dashed border-slate-300 bg-white/70 px-4 py-4 text-sm text-slate-600">
            No external share links yet.
          </div>
        )}
      </div>
    </section>
  );
}
