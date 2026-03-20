"use client";

import { useEffect, useState } from "react";

import { getApprovalTemplates, listUdmsDocuments } from "@/lib/api";
import type { ApprovalTemplate, UdmsDocumentSummary } from "@/lib/types";
import { ModulePage } from "@/components/module-page";

export default function UdmsApprovalsPage() {
  const [templates, setTemplates] = useState<ApprovalTemplate[]>([]);
  const [documents, setDocuments] = useState<UdmsDocumentSummary[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [templateItems, documentItems] = await Promise.all([
          getApprovalTemplates(),
          listUdmsDocuments(),
        ]);
        setTemplates(templateItems);
        setDocuments(documentItems.filter((item) => Boolean(item.approvalTemplateId)));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "결재 템플릿 정보를 불러오지 못했습니다.");
      }
    }
    void load();
  }, []);

  return (
    <ModulePage
      eyebrow="문서 관리 / 결재"
      title="결재 템플릿 현황"
      description="이번 단계에서는 문서에 연결된 결재 템플릿만 관리하고 실제 승인 액션은 후속 단계로 둡니다."
      highlights={[
        `${templates.length}개 활성 템플릿`,
        `${documents.length}개 템플릿 연결 문서`,
        "실제 승인 엔진은 아직 미구현",
      ]}
      actions={[{ href: "/udms/documents", label: "문서 목록", variant: "secondary" }]}
    >
      {message ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {message}
        </div>
      ) : null}

      <section className="panel rounded-[28px] p-5">
        <h2 className="font-display text-2xl font-semibold text-slate-900">활성 템플릿</h2>
        <div className="mt-4 grid gap-3">
          {templates.map((template) => (
            <div key={template.id} className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">
              <p className="text-sm font-semibold text-slate-900">{template.name}</p>
              <p className="mt-1 text-sm text-slate-600">{template.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel rounded-[28px] p-5">
        <h2 className="font-display text-2xl font-semibold text-slate-900">템플릿 연결 문서</h2>
        <div className="mt-4 grid gap-3">
          {documents.map((document) => (
            <div key={document.id} className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
              {document.title} / {document.approvalTemplateId}
            </div>
          ))}
        </div>
      </section>
    </ModulePage>
  );
}
