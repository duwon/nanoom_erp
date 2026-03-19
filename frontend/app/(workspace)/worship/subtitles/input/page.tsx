import { ModulePage } from "@/components/module-page";

export default function WorshipSubtitlesInputPage() {
  return (
    <ModulePage
      eyebrow="예배 / 자막"
      title="자막 입력"
      description="예배용 자막 문구를 직접 입력하는 화면입니다."
      highlights={[
        "순서별 입력 분리",
        "자막 콘텐츠 재사용",
        "후속 출력 연동",
      ]}
      actions={[
        { href: "/worship/subtitles/output", label: "자막 출력", variant: "secondary" },
      ]}
    />
  );
}
