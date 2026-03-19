import { ModulePage } from "@/components/module-page";

export default function WorshipOrdersPage() {
  return (
    <ModulePage
      eyebrow="예배 / 순서"
      title="예배 순서"
      description="예배 순서 입력 화면은 자막과 발표를 연결하는 중심 영역입니다."
      highlights={[
        "순서별 자막 입력",
        "현재 예배의 진행 상태 확인",
        "후속 화면으로 자연스럽게 연결",
      ]}
      actions={[
        { href: "/worship/subtitles/input", label: "자막 입력", variant: "secondary" },
        { href: "/worship/subtitles/output", label: "자막 출력", variant: "secondary" },
      ]}
    />
  );
}
