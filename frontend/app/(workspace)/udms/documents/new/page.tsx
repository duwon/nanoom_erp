"use client";

import { useRouter } from "next/navigation";

import { createUdmsDocument } from "@/lib/api";
import { ModulePage } from "@/components/module-page";
import { DocumentForm } from "@/components/udms/document-form";

export default function NewUdmsDocumentPage() {
  const router = useRouter();

  return (
    <ModulePage
      eyebrow="문서 관리 / 문서 / 신규"
      title="새 문서"
      description="문서 제목, 게시판, 결재 템플릿, 본문을 입력해 초안을 생성합니다."
      highlights={["신규 문서는 항상 초안", "게시는 상세 화면에서 수행", "첨부와 공유는 생성 후 추가"]}
      actions={[{ href: "/udms/documents", label: "문서 목록", variant: "secondary" }]}
    >
      <DocumentForm
        initialValues={{ boardId: "", title: "", content: "<p></p>", approvalTemplateId: null }}
        submitLabel="초안 생성"
        busyLabel="생성 중..."
        onSubmit={async (values) => {
          const created = await createUdmsDocument(values);
          router.push(`/udms/documents/${created.id}`);
        }}
      />
    </ModulePage>
  );
}
