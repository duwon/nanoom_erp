"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  createDocumentExternalShare,
  createWorkingCopy,
  deleteDocumentAttachment,
  deleteDocumentExternalShare,
  getAttachmentDownloadUrl,
  getDocument,
  listDocumentRevisions,
  publishDocument,
  rollbackDocument,
  updateDocumentSecurity,
  uploadDocumentAttachment,
} from "@/lib/api";
import type { DocumentAclRule, DocumentDetail, DocumentRevision } from "@/lib/types";
import { ModulePage } from "@/components/module-page";
import { AclManager } from "@/components/udms/acl-manager";
import { AttachmentManager } from "@/components/udms/attachment-manager";
import { DocumentViewer } from "@/components/udms/document-viewer";
import { ExternalShareManager } from "@/components/udms/external-share-manager";
import { buildTargetDeepLink, useTargetCatalog } from "@/components/udms/use-target-catalog";
import { VersionBrowser } from "@/components/udms/version-browser";

export default function UdmsDocumentDetailPage() {
  const params = useParams<{ documentId: string }>();
  const router = useRouter();
  const documentId = params.documentId;
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [revisions, setRevisions] = useState<DocumentRevision[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { getTargetDescriptor, message: catalogMessage } = useTargetCatalog();

  async function load() {
    if (!documentId) {
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const [detail, revisionItems] = await Promise.all([
        getDocument(documentId),
        listDocumentRevisions(documentId),
      ]);
      setDocument(detail);
      setRevisions(revisionItems);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load the document.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [documentId]);

  if (isLoading) {
    return (
      <ModulePage
        eyebrow="UDMS / Documents / Detail"
        title="Document Detail"
        description="Loading document detail."
      />
    );
  }

  if (!document) {
    return (
      <ModulePage
        eyebrow="UDMS / Documents / Detail"
        title="Document Detail"
        description={message || "The requested document was not found."}
      />
    );
  }

  const revision = document.currentRevision;
  const targetDescriptor = getTargetDescriptor(document.link.targetType);
  const targetLabel = targetDescriptor?.label ?? document.link.targetType;
  const targetLink = document.link.deepLink ?? buildTargetDeepLink(targetDescriptor, document.link.targetId);

  return (
    <ModulePage
      eyebrow="UDMS / Documents / Detail"
      title={document.header.title}
      description={`${targetLabel} / ${document.link.targetId} / ${document.state.status}`}
      highlights={[
        `Visible revision v${document.currentRevision.version}`,
        document.publishedRevision ? `Published v${document.publishedRevision.version}` : "No published revision",
        document.workingRevision ? `Working v${document.workingRevision.version}` : "No working revision",
      ]}
      actions={[
        { href: "/udms/documents", label: "All Documents", variant: "secondary" },
        ...(document.workingRevision || document.capabilities.canCreateWorkingCopy
          ? [{ href: `/udms/documents/${document.id}/edit`, label: "Edit Working Copy", variant: "secondary" as const }]
          : []),
      ]}
    >
      {message || catalogMessage ? (
        <div className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4 text-sm text-slate-700">
          {message || catalogMessage}
        </div>
      ) : null}

      <section className="panel rounded-[28px] p-5">
        <div className="flex flex-wrap gap-3">
          {targetLink ? (
            <Link
              href={targetLink}
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900"
            >
              Open Target Context
            </Link>
          ) : null}
          {document.capabilities.canCreateWorkingCopy ? (
            <button
              type="button"
              onClick={async () => {
                try {
                  await createWorkingCopy(document.id);
                  router.push(`/udms/documents/${document.id}/edit`);
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "Failed to create a working copy.");
                }
              }}
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900"
            >
              Create Working Copy
            </button>
          ) : null}

          {document.capabilities.canPublish && document.workingRevision ? (
            <button
              type="button"
              onClick={async () => {
                try {
                  await publishDocument(document.id);
                  setMessage("Document published.");
                  await load();
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "Failed to publish the document.");
                }
              }}
              className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
            >
              Publish
            </button>
          ) : null}
        </div>
      </section>

      <DocumentViewer revision={revision} />

      <AttachmentManager
        attachments={revision.attachments}
        canEdit={document.capabilities.canEditWorkingCopy}
        onUpload={async (file) => {
          try {
            await uploadDocumentAttachment(document.id, file);
            setMessage("Attachment uploaded.");
            await load();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to upload the attachment.");
          }
        }}
        onDelete={async (attachmentId) => {
          try {
            await deleteDocumentAttachment(attachmentId);
            setMessage("Attachment deleted.");
            await load();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to delete the attachment.");
          }
        }}
        getDownloadUrl={getAttachmentDownloadUrl}
      />

      <AclManager
        acl={document.security.acl}
        canManage={document.capabilities.canManageSecurity}
        onSave={async (acl: DocumentAclRule[]) => {
          try {
            await updateDocumentSecurity(document.id, { acl });
            setMessage("Document ACL updated.");
            await load();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to update ACL.");
          }
        }}
      />

      <ExternalShareManager
        links={document.security.externalShares}
        canManage={document.capabilities.canManageSecurity}
        onCreate={async (payload) => {
          try {
            await createDocumentExternalShare(document.id, payload);
            setMessage("External share link created.");
            await load();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to create an external share link.");
          }
        }}
        onDelete={async (shareId) => {
          try {
            await deleteDocumentExternalShare(document.id, shareId);
            setMessage("External share link deleted.");
            await load();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to delete the external share link.");
          }
        }}
      />

      <VersionBrowser
        revisions={revisions}
        canRollback={document.capabilities.canEditWorkingCopy}
        onRollback={async (version) => {
          try {
            await rollbackDocument(document.id, version);
            setMessage(`Working copy restored from v${version}.`);
            await load();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to rollback the document.");
          }
        }}
      />
    </ModulePage>
  );
}
