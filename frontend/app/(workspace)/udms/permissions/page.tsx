import { ModulePage } from "@/components/module-page";

export default function UdmsPermissionsPage() {
  return (
    <ModulePage
      eyebrow="문서 관리 / 권한"
      title="문서 권한"
      description="문서 권한은 열람, 편집, 공유, 결재를 구분해서 관리합니다."
      highlights={[
        "문서 단위 권한",
        "역할과 사용자, 부서 조합",
        "관리자 권한과 일반 권한 분리",
      ]}
      actions={[
        { href: "/admin/permissions", label: "관리자 권한", variant: "secondary" },
      ]}
    />
  );
}
