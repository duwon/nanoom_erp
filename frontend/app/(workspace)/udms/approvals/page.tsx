import { ModulePage } from "@/components/module-page";

export default function UdmsApprovalsPage() {
  return (
    <ModulePage
      eyebrow="UDMS / Approvals"
      title="문서 결재"
      description="문서 결재는 초안, 검토, 승인, 반려의 흐름으로 확장합니다."
      highlights={[
        "문서 단위 결재",
        "역할 기반 승인 라인",
        "이력 관리와 함께 저장",
      ]}
      actions={[
        { href: "/udms/documents", label: "문서 목록", variant: "secondary" },
      ]}
    />
  );
}
