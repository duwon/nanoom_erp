import { ModulePage } from "@/components/module-page";

export default function UdmsDocumentsPage() {
  return (
    <ModulePage
      eyebrow="UDMS / Documents"
      title="문서"
      description="문서는 본문, 버전, 첨부파일, 공유, 결재, 권한을 함께 가집니다."
      highlights={[
        "버전 이력 누적",
        "첨부파일 분리 관리",
        "공유와 결재가 같은 문서에 붙는 구조",
      ]}
      actions={[
        { href: "/udms/shares", label: "공유", variant: "secondary" },
        { href: "/udms/approvals", label: "결재", variant: "secondary" },
      ]}
    />
  );
}
