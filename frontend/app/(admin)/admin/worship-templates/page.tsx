import { ModulePage } from "@/components/module-page";

export default function AdminWorshipTemplatesPage() {
  return (
    <ModulePage
      eyebrow="Admin / Worship"
      title="예배 순서 템플릿"
      description="예배 템플릿은 관리자만 관리합니다. 사용자 작업영역은 순서 편집과 자막 입력에 집중합니다."
      highlights={[
        "템플릿 생성/수정/배포",
        "사용자 입력용 기준 골격",
        "순서 편집과 분리된 관리",
      ]}
      actions={[
        { href: "/admin", label: "관리자 홈", variant: "secondary" },
      ]}
    />
  );
}
