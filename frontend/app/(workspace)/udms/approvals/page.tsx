import { ModulePage } from "@/components/module-page";

export default function UdmsApprovalsPage() {
  return (
    <ModulePage
      eyebrow="문서 관리 / 결재"
      title="문서 결재"
      description="문서 결재는 검토, 승인, 반려를 한 흐름으로 다룹니다."
      highlights={[
        "문서 단위 결재",
        "역할 기반 승인 흐름",
        "대기 문서를 빠르게 처리",
      ]}
      actions={[
        { href: "/udms/documents", label: "문서 목록", variant: "secondary" },
      ]}
    />
  );
}
