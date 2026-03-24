"use client";

import { useEffect, useState } from "react";

import { getApprovalTemplates } from "@/lib/api";
import type { ApprovalTemplate } from "@/lib/types";
import { ModulePage } from "@/components/module-page";
import { DocumentContainer } from "@/components/udms/document-container";

export default function UdmsApprovalsPage() {
  const [templates, setTemplates] = useState<ApprovalTemplate[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setTemplates(await getApprovalTemplates());
        setMessage("");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to load approval templates.");
      }
    }

    void load();
  }, []);

  return (
    <ModulePage
      eyebrow="UDMS / Approval"
      title="Approval Documents"
      description="Approval-linked documents are now tracked by target context and module data instead of a document-level approval template field."
      highlights={[
        `${templates.length} templates available`,
        "Approval documents use targetType=Approval",
        "Completion hooks can lock published documents",
      ]}
      actions={[{ href: "/udms/documents", label: "All Documents", variant: "secondary" }]}
    >
      {message ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {message}
        </div>
      ) : null}

      <section className="panel rounded-[28px] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Templates</p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900">Approval Templates</h2>
        <div className="mt-4 grid gap-3">
          {templates.length ? (
            templates.map((template) => (
              <div key={template.id} className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">
                <p className="text-sm font-semibold text-slate-900">{template.name}</p>
                <p className="mt-1 text-sm text-slate-600">{template.description}</p>
              </div>
            ))
          ) : (
            <div className="rounded-[20px] border border-dashed border-slate-300 bg-white/70 px-4 py-4 text-sm text-slate-600">
              No approval templates are configured yet.
            </div>
          )}
        </div>
      </section>

      <DocumentContainer targetType="Approval" targetId="" />
    </ModulePage>
  );
}
