import { ModulePage } from "@/components/module-page";

export default function UdmsDocumentsPage() {
  return (
    <ModulePage
      eyebrow="문서 관리 / 문서"
      title="문서"
      description="문서는 버전, 첨부 파일, 공유, 결재, 권한을 함께 다룹니다."
      highlights={[
        "버전 이력 관리",
        "첨부 파일 분리 관리",
        "공유와 결재가 같은 문서 구조로 연결",
      ]}
      actions={[
        { href: "/udms/shares", label: "공유", variant: "secondary" },
        { href: "/udms/approvals", label: "결재", variant: "secondary" },
      ]}
    />
  );
}
