"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createWorkingCopy, getDocument, updateDocument } from "@/lib/api";
import type { DocumentDetail } from "@/lib/types";
import { ModulePage } from "@/components/module-page";
import { DocumentForm } from "@/components/udms/document-form";

function readApprovalTemplateId(moduleData: Record<string, unknown>) {
  const approval = moduleData.approval;
  if (!approval || typeof approval !== "object") {
    return null;
  }

  const templateId = (approval as { templateId?: unknown }).templateId;
  return typeof templateId === "string" ? templateId : null;
}

export default function EditUdmsDocumentPage() {
  const params = useParams<{ documentId: string }>();
  const router = useRouter();
  const documentId = params.documentId;
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!documentId) {
      return;
    }

    async function load() {
      try {
        let response = await getDocument(documentId);
        if (!response.workingRevision && response.capabilities.canCreateWorkingCopy) {
          response = await createWorkingCopy(documentId);
        }
        setDocument(response);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to load the document.");
      }
    }

    void load();
  }, [documentId]);

  if (!document) {
    return (
      <ModulePage
        eyebrow="UDMS / Documents / Edit"
        title="Edit Document"
        description={message || "Loading the working copy."}
      />
    );
  }

  const revision = document.workingRevision ?? document.currentRevision;

  return (
    <ModulePage
      eyebrow="UDMS / Documents / Edit"
      title={`Edit ${revision.header.title}`}
      description="The working revision updates the document root pointers while older revisions remain immutable."
      actions={[{ href: `/udms/documents/${document.id}`, label: "Back to Detail", variant: "secondary" }]}
    >
      <DocumentForm
        initialValues={{
          title: revision.header.title,
          category: revision.header.category,
          tagsText: revision.header.tags.join(", "),
          targetType: document.link.targetType,
          targetId: document.link.targetId,
          body: revision.body ?? "<p></p>",
          approvalTemplateId: readApprovalTemplateId(revision.moduleData),
          changeLog: revision.changeLog,
        }}
        submitLabel="Save Draft"
        busyLabel="Saving..."
        onSubmit={async (values) => {
          const updated = await updateDocument(document.id, values);
          router.push(`/udms/documents/${updated.id}`);
        }}
      />
    </ModulePage>
  );
}
