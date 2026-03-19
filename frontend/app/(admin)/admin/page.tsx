import { ModulePage } from "@/components/module-page";

export default function AdminHomePage() {
  return (
    <ModulePage
      eyebrow="Admin"
      title="관리자 콘솔"
      description="사용자, 게시판, 예배 템플릿, 권한을 관리하는 전용 공간입니다."
      highlights={[
        "사용자, 게시판, 권한 관리",
        "예배 템플릿 관리 전용",
        "사용자 작업영역과 분리",
      ]}
      actions={[
        { href: "/admin/users", label: "사용자 관리" },
        { href: "/admin/boards", label: "게시판 관리", variant: "secondary" },
        { href: "/admin/worship-templates", label: "예배 템플릿", variant: "secondary" },
      ]}
    />
  );
}
