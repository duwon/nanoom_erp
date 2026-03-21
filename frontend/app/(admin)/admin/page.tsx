import { ModulePage } from "@/components/module-page";

export default function AdminHomePage() {
  return (
    <ModulePage
      eyebrow="Admin"
      title="관리자 콘솔"
      description="예배 템플릿 V2 기준으로 공통 리소스와 운영 설정을 분리해 관리합니다."
      highlights={[
        "예배 템플릿은 메타와 순서만 관리",
        "순서 타입, 입력 템플릿, 슬라이드 템플릿은 전역 재사용",
        "공통 리소스 사용량을 함께 확인",
      ]}
      actions={[
        { href: "/admin/users", label: "사용자 관리" },
        { href: "/admin/boards", label: "게시판 관리", variant: "secondary" },
        { href: "/admin/worship-templates", label: "예배 템플릿", variant: "secondary" },
        { href: "/admin/worship-section-types", label: "순서 타입", variant: "secondary" },
        { href: "/admin/worship-input-templates", label: "입력 템플릿", variant: "secondary" },
        { href: "/admin/worship-slide-templates", label: "슬라이드 템플릿", variant: "secondary" },
      ]}
    />
  );
}
