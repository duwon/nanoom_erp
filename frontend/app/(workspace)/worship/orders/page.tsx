import { ModulePage } from "@/components/module-page";

export default function WorshipOrdersPage() {
  return (
    <ModulePage
      eyebrow="Worship / Orders"
      title="예배 순서"
      description="순서 편집 화면은 자막과 발표 자료를 호출하는 중심이 됩니다."
      highlights={[
        "순서별 자막 입력",
        "담당자 분담 편집",
        "향후 실시간 협업 확장",
      ]}
      actions={[
        { href: "/worship/subtitles/input", label: "자막 입력", variant: "secondary" },
        { href: "/worship/subtitles/output", label: "자막 출력", variant: "secondary" },
      ]}
    />
  );
}
