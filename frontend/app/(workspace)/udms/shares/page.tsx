"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getSharedDocuments } from "@/lib/api";
import type { SharedDocumentsOverview } from "@/lib/types";
import { ModulePage } from "@/components/module-page";
import { buildTargetDeepLink, useTargetCatalog } from "@/components/udms/use-target-catalog";

const emptyOverview: SharedDocumentsOverview = {
  accessible: [],
  externalLinks: [],
};

export default function UdmsSharesPage() {
  const [overview, setOverview] = useState<SharedDocumentsOverview>(emptyOverview);
  const [message, setMessage] = useState("");
  const { getTargetDescriptor, message: catalogMessage } = useTargetCatalog();

  useEffect(() => {
    async function load() {
      try {
        setOverview(await getSharedDocuments());
        setMessage("");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to load shared documents.");
      }
    }

    void load();
  }, []);

  return (
    <ModulePage
      eyebrow="UDMS / Shared"
      title="Shared Documents"
      description="This view shows documents visible through ACL inheritance and external links created from document security settings."
      highlights={[
        `${overview.accessible.length} accessible documents`,
        `${overview.externalLinks.length} external share links`,
        "Shares are derived from document security, not standalone rows",
      ]}
      actions={[{ href: "/udms/documents", label: "All Documents", variant: "secondary" }]}
    >
      {message || catalogMessage ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {message || catalogMessage}
        </div>
      ) : null}

      <section className="panel rounded-[28px] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">ACL Access</p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900">Accessible Documents</h2>
        <div className="mt-4 grid gap-3">
          {overview.accessible.length ? (
            overview.accessible.map((item) => (
              <Link
                key={`${item.document.id}-${item.accessSource}`}
                href={`/udms/documents/${item.document.id}`}
                className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700"
              >
                <p className="font-semibold text-slate-900">{item.document.header.title}</p>
                <p className="mt-1 text-slate-600">{item.accessSource}</p>
              </Link>
            ))
          ) : (
            <div className="rounded-[20px] border border-dashed border-slate-300 bg-white/70 px-4 py-4 text-sm text-slate-600">
              No shared documents are visible to the current user.
            </div>
          )}
        </div>
      </section>

      <section className="panel rounded-[28px] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">External Links</p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900">Issued Share Links</h2>
        <div className="mt-4 grid gap-3">
          {overview.externalLinks.length ? (
            overview.externalLinks.map((item) => {
              const descriptor = getTargetDescriptor(item.targetType);
              const targetLabel = descriptor?.label ?? item.targetType;
              const targetLink = buildTargetDeepLink(descriptor, item.targetId);
              return (
                <div key={item.link.id} className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">{item.documentTitle}</p>
                  <p className="mt-1 break-all text-slate-600">
                    {targetLabel} / {item.targetId} / token {item.link.token}
                  </p>
                  {targetLink ? (
                    <Link href={targetLink} className="mt-2 inline-flex text-sm font-medium text-amber-700 underline-offset-4 hover:underline">
                      Open target context
                    </Link>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="rounded-[20px] border border-dashed border-slate-300 bg-white/70 px-4 py-4 text-sm text-slate-600">
              No external share links have been created yet.
            </div>
          )}
        </div>
      </section>
    </ModulePage>
  );
}
