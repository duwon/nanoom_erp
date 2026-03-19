import { ModulePage } from "@/components/module-page";

export default function WorshipSubtitlesOutputPage() {
  return (
    <ModulePage
      eyebrow="예배 / 출력"
      title="자막 출력"
      description="입력된 자막을 예배 현장 디스플레이로 송출하는 화면입니다."
      highlights={[
        "출력 전용 화면",
        "실시간 상태 반영",
        "디스플레이 화면과 연결",
      ]}
      actions={[
        { href: "/display", label: "디스플레이 열기", variant: "secondary" },
      ]}
    />
  );
}
