import { ModulePage } from "@/components/module-page";

export default function UdmsPermissionsPage() {
  return (
    <ModulePage
      eyebrow="UDMS / Permissions"
      title="문서 권한"
      description="문서 권한은 읽기, 편집, 공유, 결재를 분리해서 관리합니다."
      highlights={[
        "문서 단위 권한",
        "역할/사용자/부서 조합 가능",
        "관리자 권한과 일반 권한 분리",
      ]}
      actions={[
        { href: "/admin/permissions", label: "관리자 권한", variant: "secondary" },
      ]}
    />
  );
}
