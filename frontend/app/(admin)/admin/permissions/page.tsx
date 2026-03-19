import { ModulePage } from "@/components/module-page";

export default function AdminPermissionsPage() {
  return (
    <ModulePage
      eyebrow="Admin / Permissions"
      title="권한 관리"
      description="문서, 게시판, 템플릿, 향후 결재 흐름을 모두 권한 기반으로 묶습니다."
      highlights={[
        "역할 기반 접근 제어",
        "문서 단위 공유와 편집 분리",
        "결재/승인 흐름과 결합 가능",
      ]}
      actions={[
        { href: "/udms/permissions", label: "UDMS 권한", variant: "secondary" },
        { href: "/admin", label: "관리자 홈" },
      ]}
    />
  );
}
