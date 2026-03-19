import { ModulePage } from "@/components/module-page";

export default function WorshipSubtitlesOutputPage() {
  return (
    <ModulePage
      eyebrow="Worship / Output"
      title="예배 자막 출력"
      description="입력된 자막을 현장 송출용 화면과 연결합니다."
      highlights={[
        "읽기 전용 출력",
        "실시간 갱신 대상",
        "display 화면과 연결",
      ]}
      actions={[
        { href: "/display", label: "Display 열기", variant: "secondary" },
      ]}
    />
  );
}
