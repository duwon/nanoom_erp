import { ModulePage } from "@/components/module-page";

export default function AdminHomePage() {
  return (
    <ModulePage
      eyebrow="관리자"
      title="관리자 콘솔"
      description="사용자, 게시판, 예배 템플릿, 권한을 한 곳에서 관리하는 영역입니다."
      highlights={[
        "사용자와 상태 관리",
        "예배 템플릿 운영",
        "관리자 업무를 한 화면에 모음",
      ]}
      actions={[
        { href: "/admin/users", label: "사용자 관리" },
        { href: "/admin/boards", label: "게시판 관리", variant: "secondary" },
        { href: "/admin/worship-templates", label: "예배 템플릿", variant: "secondary" },
      ]}
    />
  );
}
