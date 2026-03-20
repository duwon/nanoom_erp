"use client";

import { useRouter } from "next/navigation";

import { createDocument } from "@/lib/api";
import { ModulePage } from "@/components/module-page";
import { DocumentForm } from "@/components/udms/document-form";

export default function NewUdmsDocumentPage() {
  const router = useRouter();

  return (
    <ModulePage
      eyebrow="UDMS / Documents / New"
      title="New Document"
      description="Create a document root with its first revision, target link, and optional module data."
      highlights={[
        "Atomic root + revision structure",
        "Only enabled target types can create new documents",
        "Approval templates move into moduleData",
      ]}
      actions={[{ href: "/udms/documents", label: "All Documents", variant: "secondary" }]}
    >
      <DocumentForm
        initialValues={{
          title: "",
          category: "BoardPost",
          tagsText: "",
          targetType: "Board",
          targetId: "",
          body: "<p></p>",
          approvalTemplateId: null,
          changeLog: "",
        }}
        submitLabel="Create Draft"
        busyLabel="Creating..."
        onSubmit={async (values) => {
          const created = await createDocument(values);
          router.push(`/udms/documents/${created.id}`);
        }}
      />
    </ModulePage>
  );
}
