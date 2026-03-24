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
import { AclManager } from "@/components/udms/acl-manager";
import { AttachmentManager } from "@/components/udms/attachment-manager";
import { ExternalShareManager } from "@/components/udms/external-share-manager";
import { buildTargetDeepLink, useTargetCatalog } from "@/components/udms/use-target-catalog";

const statusLabels: Record<string, string> = {
  draft: "초안",
  published: "게시됨",
  locked: "잠김",
  archived: "보관됨",
};

const statusStyles: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  published: "bg-green-100 text-green-700",
  locked: "bg-amber-100 text-amber-700",
  archived: "bg-rose-100 text-rose-700",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function UdmsDocumentDetailPage() {
  const params = useParams<{ documentId: string }>();
  const router = useRouter();
  const documentId = params.documentId;
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [revisions, setRevisions] = useState<DocumentRevision[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const { getTargetDescriptor, message: catalogMessage } = useTargetCatalog();

  async function load() {
    if (!documentId) return;
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
      setMessage(error instanceof Error ? error.message : "문서를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [documentId]);

  if (isLoading) {
    return (
      <div className="px-4 py-16 text-center text-sm text-slate-400">불러오는 중...</div>
    );
  }

  if (!document) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {message || "문서를 찾을 수 없습니다."}
        </div>
        <Link href="/udms/documents" className="text-sm text-slate-500 hover:text-slate-900">
          ← 문서 목록
        </Link>
      </div>
    );
  }

  const revision = document.currentRevision;
  const targetDescriptor = getTargetDescriptor(document.link.targetType);
  const targetLabel = targetDescriptor?.label ?? document.link.targetType;
  const targetLink = document.link.deepLink ?? buildTargetDeepLink(targetDescriptor, document.link.targetId);

  return (
    <div className="flex flex-col gap-6">
      {/* 상단 액션 바 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/udms/documents" className="text-sm text-slate-500 hover:text-slate-900">
          ← 문서 목록
        </Link>
        <div className="flex flex-wrap gap-2">
          {targetLink ? (
            <Link
              href={targetLink}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              대상 열기
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
                  setMessage(error instanceof Error ? error.message : "편집 사본을 만들지 못했습니다.");
                }
              }}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              편집
            </button>
          ) : null}
          {document.workingRevision ? (
            <Link
              href={`/udms/documents/${document.id}/edit`}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              편집 중인 버전
            </Link>
          ) : null}
          {document.capabilities.canPublish && document.workingRevision ? (
            <button
              type="button"
              onClick={async () => {
                try {
                  await publishDocument(document.id);
                  setMessage("게시되었습니다.");
                  await load();
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "게시에 실패했습니다.");
                }
              }}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              게시
            </button>
          ) : null}
        </div>
      </div>

      {message || catalogMessage ? (
        <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {message || catalogMessage}
        </div>
      ) : null}

      {/* 본문 */}
      <article className="panel rounded-[28px] overflow-hidden">
        {/* 제목 영역 */}
        <div className="border-b border-slate-100 px-6 py-6 sm:px-8 sm:py-8">
          {document.header.tags.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {document.header.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <h1 className="font-display text-2xl font-semibold text-slate-900 sm:text-3xl">
            {document.header.title}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[document.state.status] ?? "bg-slate-100 text-slate-600"}`}>
              {statusLabels[document.state.status] ?? document.state.status}
            </span>
            <span>v{revision.version}</span>
            <span>
              {targetLabel}
              {document.link.targetId ? ` / ${document.link.targetId}` : ""}
            </span>
            <span>{formatDate(document.metadata.updatedAt)}</span>
            {revision.changeLog ? (
              <span className="text-slate-400">{revision.changeLog}</span>
            ) : null}
          </div>
        </div>

        {/* 본문 내용 */}
        <div className="px-6 py-6 sm:px-8 sm:py-8">
          {revision.body ? (
            <div
              className="prose prose-slate max-w-none text-sm leading-7"
              dangerouslySetInnerHTML={{ __html: revision.body }}
            />
          ) : (
            <p className="text-sm text-slate-400">내용이 없습니다.</p>
          )}
        </div>
      </article>

      {/* 첨부파일 */}
      <AttachmentManager
        attachments={revision.attachments}
        canEdit={document.capabilities.canEditWorkingCopy}
        onUpload={async (file) => {
          try {
            await uploadDocumentAttachment(document.id, file);
            await load();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "첨부파일 업로드에 실패했습니다.");
          }
        }}
        onDelete={async (attachmentId) => {
          try {
            await deleteDocumentAttachment(attachmentId);
            await load();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "첨부파일 삭제에 실패했습니다.");
          }
        }}
        getDownloadUrl={getAttachmentDownloadUrl}
      />

      {/* 버전 이력 */}
      <section className="panel rounded-[28px] overflow-hidden">
        <button
          type="button"
          className="flex w-full items-center justify-between px-6 py-4 text-left"
          onClick={() => setHistoryOpen((v) => !v)}
        >
          <span className="text-sm font-semibold text-slate-700">버전 이력</span>
          <span className="text-xs text-slate-400">{historyOpen ? "접기" : `${revisions.length}개 버전 보기`}</span>
        </button>
        {historyOpen ? (
          <div className="border-t border-slate-100">
            {revisions.length === 0 ? (
              <p className="px-6 py-4 text-sm text-slate-400">버전 이력이 없습니다.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">버전</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">변경 내역</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">작성자</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">일시</th>
                    {document.capabilities.canEditWorkingCopy ? (
                      <th className="px-4 py-3" />
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {revisions.map((rev) => (
                    <tr key={rev.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-6 py-3">
                        <span className="font-medium text-slate-900">v{rev.version}</span>
                        {rev.isCurrent ? (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">현재</span>
                        ) : null}
                        {rev.isPublished ? (
                          <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">게시됨</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{rev.changeLog || "-"}</td>
                      <td className="px-4 py-3 text-slate-500">{rev.createdBy}</td>
                      <td className="px-4 py-3 text-slate-400">{formatDate(rev.createdAt)}</td>
                      {document.capabilities.canEditWorkingCopy ? (
                        <td className="px-4 py-3 text-right">
                          {!rev.isCurrent ? (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await rollbackDocument(document.id, rev.version);
                                  setMessage(`v${rev.version}으로 복원했습니다.`);
                                  await load();
                                } catch (error) {
                                  setMessage(error instanceof Error ? error.message : "복원에 실패했습니다.");
                                }
                              }}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                            >
                              이 버전으로 복원
                            </button>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}
      </section>

      {/* 보안 관리 */}
      {document.capabilities.canManageSecurity ? (
        <section className="panel rounded-[28px] overflow-hidden">
          <button
            type="button"
            className="flex w-full items-center justify-between px-6 py-4 text-left"
            onClick={() => setSecurityOpen((v) => !v)}
          >
            <span className="text-sm font-semibold text-slate-700">보안 관리</span>
            <span className="text-xs text-slate-400">{securityOpen ? "접기" : "ACL · 외부 공유"}</span>
          </button>
          {securityOpen ? (
            <div className="flex flex-col gap-4 border-t border-slate-100 px-6 py-5">
              <AclManager
                acl={document.security.acl}
                canManage={document.capabilities.canManageSecurity}
                onSave={async (acl: DocumentAclRule[]) => {
                  try {
                    await updateDocumentSecurity(document.id, { acl });
                    setMessage("권한이 저장되었습니다.");
                    await load();
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "권한 저장에 실패했습니다.");
                  }
                }}
              />
              <ExternalShareManager
                links={document.security.externalShares}
                canManage={document.capabilities.canManageSecurity}
                onCreate={async (payload) => {
                  try {
                    await createDocumentExternalShare(document.id, payload);
                    setMessage("외부 공유 링크가 생성되었습니다.");
                    await load();
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "링크 생성에 실패했습니다.");
                  }
                }}
                onDelete={async (shareId) => {
                  try {
                    await deleteDocumentExternalShare(document.id, shareId);
                    setMessage("외부 공유 링크가 삭제되었습니다.");
                    await load();
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "링크 삭제에 실패했습니다.");
                  }
                }}
              />
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
