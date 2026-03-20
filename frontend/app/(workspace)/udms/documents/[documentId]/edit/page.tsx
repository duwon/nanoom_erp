"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getUdmsDocument, updateUdmsDocument } from "@/lib/api";
import type { UdmsDocumentDetail } from "@/lib/types";
import { ModulePage } from "@/components/module-page";
import { DocumentForm } from "@/components/udms/document-form";

export default function EditUdmsDocumentPage() {
  const params = useParams<{ documentId: string }>();
  const router = useRouter();
  const documentId = params.documentId;
  const [document, setDocument] = useState<UdmsDocumentDetail | null>(null);

  useEffect(() => {
    if (!documentId) {
      return;
    }
    async function load() {
      const response = await getUdmsDocument(documentId);
      setDocument(response);
    }
    void load();
  }, [documentId]);

  if (!document) {
    return (
      <ModulePage
        eyebrow="문서 관리 / 문서 / 편집"
        title="문서 편집"
        description="문서를 불러오는 중입니다."
      />
    );
  }

  return (
    <ModulePage
      eyebrow="문서 관리 / 문서 / 편집"
      title={`${document.title} 편집`}
      description="draft 문서만 편집할 수 있습니다. 게시와 첨부, 공유 관리는 상세 화면에서 이어집니다."
      actions={[{ href: `/udms/documents/${document.id}`, label: "상세로 돌아가기", variant: "secondary" }]}
    >
      <DocumentForm
        initialValues={{
          boardId: document.boardId,
          title: document.title,
          content: document.content,
          approvalTemplateId: document.approvalTemplateId,
        }}
        submitLabel="초안 저장"
        busyLabel="저장 중..."
        onSubmit={async (values) => {
          const updated = await updateUdmsDocument(document.id, values);
          router.push(`/udms/documents/${updated.id}`);
        }}
      />
    </ModulePage>
  );
}
