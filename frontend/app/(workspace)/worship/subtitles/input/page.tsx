import { ModulePage } from "@/components/module-page";

export default function WorshipSubtitlesInputPage() {
  return (
    <ModulePage
      eyebrow="Worship / Subtitles"
      title="예배 자막 입력"
      description="여러 사용자가 자신에게 할당된 순서의 자막을 입력하는 화면입니다."
      highlights={[
        "순서별 입력 분리",
        "자막 컨텐츠 재사용",
        "후속 저장/출력 연동",
      ]}
      actions={[
        { href: "/worship/subtitles/output", label: "자막 출력", variant: "secondary" },
      ]}
    />
  );
}
