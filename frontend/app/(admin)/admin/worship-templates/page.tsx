import { ModulePage } from "@/components/module-page";

export default function AdminWorshipTemplatesPage() {
  return (
    <ModulePage
      eyebrow="관리자 / 예배"
      title="예배 템플릿"
      description="예배 템플릿은 관리자만 관리합니다. 예배 순서와 자막 입력을 위한 기준이 됩니다."
      highlights={[
        "템플릿 생성과 수정, 배포",
        "예배 입력의 기준 정리",
        "예배 순서와의 분리 관리",
      ]}
      actions={[
        { href: "/admin", label: "관리자 홈", variant: "secondary" },
      ]}
    />
  );
}
