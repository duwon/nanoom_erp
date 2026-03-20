"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  createUdmsNextVersion,
  deleteDocumentAttachment,
  getAttachmentDownloadUrl,
  getUdmsDocument,
  getUdmsVersions,
  publishUdmsDocument,
  replaceDocumentShares,
  uploadDocumentAttachment,
} from "@/lib/api";
import type { DocumentShare, SharePermission, ShareTargetType, UdmsDocumentDetail, UdmsDocumentSummary } from "@/lib/types";
import { ModulePage } from "@/components/module-page";

const emptyShare = { targetType: "user" as ShareTargetType, targetId: "", permission: "read" as SharePermission };

export default function UdmsDocumentDetailPage() {
  const params = useParams<{ documentId: string }>();
  const router = useRouter();
  const documentId = params.documentId;
  const [document, setDocument] = useState<UdmsDocumentDetail | null>(null);
  const [versions, setVersions] = useState<UdmsDocumentSummary[]>([]);
  const [shares, setShares] = useState<Array<{ targetType: ShareTargetType; targetId: string; permission: SharePermission }>>([emptyShare]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!documentId) {
      return;
    }
    async function load() {
      setIsLoading(true);
      setMessage("");
      try {
        const [detail, versionItems] = await Promise.all([
          getUdmsDocument(documentId),
          getUdmsVersions(documentId),
        ]);
        setDocument(detail);
        setVersions(versionItems);
        setShares(
          detail.shares.length
            ? detail.shares.map((share) => ({
                targetType: share.targetType,
                targetId: share.targetId,
                permission: share.permission,
              }))
            : [emptyShare],
        );
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "문서를 불러오지 못했습니다.");
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [documentId]);

  async function refresh() {
    if (!documentId) {
      return;
    }
    const [detail, versionItems] = await Promise.all([getUdmsDocument(documentId), getUdmsVersions(documentId)]);
    setDocument(detail);
    setVersions(versionItems);
  }

  if (isLoading) {
    return (
      <ModulePage
        eyebrow="문서 관리 / 문서 / 상세"
        title="문서 상세"
        description="문서를 불러오는 중입니다."
      />
    );
  }

  if (!document) {
    return (
      <ModulePage
        eyebrow="문서 관리 / 문서 / 상세"
        title="문서 상세"
        description={message || "문서를 찾을 수 없습니다."}
      />
    );
  }

  return (
    <ModulePage
      eyebrow="문서 관리 / 문서 / 상세"
      title={document.title}
      description={`상태 ${document.status} / 버전 ${document.versionNumber} / 작성자 ${document.createdBy}`}
      highlights={[
        document.approvalTemplateId ? `결재 템플릿 ${document.approvalTemplateId}` : "결재 템플릿 없음",
        `${document.attachments.length}개 첨부`,
        `${versions.length}개 버전`,
      ]}
      actions={[
        { href: "/udms/documents", label: "문서 목록", variant: "secondary" },
        ...(document.status === "draft"
          ? [{ href: `/udms/documents/${document.id}/edit`, label: "초안 편집" as const, variant: "secondary" as const }]
          : []),
      ]}
    >
      {message ? (
        <div className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <section className="panel rounded-[28px] p-5">
        <div className="flex flex-wrap gap-3">
          {document.status === "draft" ? (
            <button
              type="button"
              onClick={async () => {
                try {
                  const updated = await publishUdmsDocument(document.id);
                  setDocument(updated);
                  await refresh();
                  setMessage("문서를 게시했습니다.");
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "문서 게시에 실패했습니다.");
                }
              }}
              className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
            >
              게시
            </button>
          ) : null}
          {document.status === "published" ? (
            <button
              type="button"
              onClick={async () => {
                try {
                  const next = await createUdmsNextVersion(document.id);
                  router.push(`/udms/documents/${next.id}/edit`);
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "새 버전 생성에 실패했습니다.");
                }
              }}
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900"
            >
              새 버전 생성
            </button>
          ) : null}
        </div>
        <div
          className="mt-5 rounded-[24px] border border-slate-200 bg-white px-5 py-4 text-sm leading-7 text-slate-700"
          dangerouslySetInnerHTML={{ __html: document.content }}
        />
      </section>

      <section className="panel rounded-[28px] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">첨부</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900">첨부 파일</h2>
          </div>
          {document.status === "draft" ? (
            <label className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900">
              파일 올리기
              <input
                type="file"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) {
                    return;
                  }
                  try {
                    await uploadDocumentAttachment(document.id, file);
                    await refresh();
                    setMessage("첨부 파일을 추가했습니다.");
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "첨부 업로드에 실패했습니다.");
                  }
                }}
              />
            </label>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3">
          {document.attachments.map((attachment) => (
            <div key={attachment.id} className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{attachment.fileName}</p>
                  <p className="text-sm text-slate-600">{Math.round(attachment.sizeBytes / 1024)} KB</p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={getAttachmentDownloadUrl(attachment.id)}
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    다운로드
                  </a>
                  {document.status === "draft" ? (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await deleteDocumentAttachment(attachment.id);
                          await refresh();
                          setMessage("첨부 파일을 삭제했습니다.");
                        } catch (error) {
                          setMessage(error instanceof Error ? error.message : "첨부 삭제에 실패했습니다.");
                        }
                      }}
                      className="rounded-full border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700"
                    >
                      삭제
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel rounded-[28px] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">공유</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900">공유 설정</h2>
          </div>
          <button
            type="button"
            onClick={() => setShares((current) => [...current, emptyShare])}
            className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900"
          >
            공유 추가
          </button>
        </div>
        <div className="mt-4 grid gap-3">
          {shares.map((share, index) => (
            <div key={`${share.targetType}-${index}`} className="grid gap-3 rounded-[20px] border border-slate-200 bg-white px-4 py-4 sm:grid-cols-3">
              <select
                value={share.targetType}
                onChange={(event) =>
                  setShares((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, targetType: event.target.value as ShareTargetType } : item,
                    ),
                  )
                }
                className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
              >
                <option value="user">사용자</option>
                <option value="department">부서</option>
              </select>
              <input
                value={share.targetId}
                onChange={(event) =>
                  setShares((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, targetId: event.target.value } : item,
                    ),
                  )
                }
                placeholder="대상 ID 또는 부서명"
                className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
              />
              <select
                value={share.permission}
                onChange={(event) =>
                  setShares((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, permission: event.target.value as SharePermission } : item,
                    ),
                  )
                }
                className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400"
              >
                <option value="read">읽기</option>
                <option value="edit">편집</option>
              </select>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={async () => {
              try {
                await replaceDocumentShares(
                  document.id,
                  shares.filter((share) => share.targetId.trim().length > 0),
                );
                await refresh();
                setMessage("공유 설정을 저장했습니다.");
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "공유 저장에 실패했습니다.");
              }
            }}
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
          >
            공유 저장
          </button>
        </div>
      </section>

      <section className="panel rounded-[28px] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">버전</p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900">버전 히스토리</h2>
        <div className="mt-4 grid gap-3">
          {versions.map((version) => (
            <Link
              key={version.id}
              href={`/udms/documents/${version.id}`}
              className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700"
            >
              버전 {version.versionNumber} / {version.status} / {version.updatedAt}
            </Link>
          ))}
        </div>
      </section>
    </ModulePage>
  );
}
