import { ModulePage } from "@/components/module-page";

export default function AdminPermissionsPage() {
  return (
    <ModulePage
      eyebrow="관리자 / 권한"
      title="권한 관리"
      description="문서, 게시판, 예배 템플릿과 연결되는 접근 권한을 관리합니다."
      highlights={[
        "역할 기반 접근 제어",
        "문서 단위 권한 분리",
        "결재/승인과의 연계",
      ]}
      actions={[
        { href: "/udms/permissions", label: "문서 관리 권한", variant: "secondary" },
        { href: "/admin", label: "관리자 홈", variant: "secondary" },
      ]}
    />
  );
}
