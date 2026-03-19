import { ModulePage } from "@/components/module-page";

export default function WorshipContentsPage() {
  return (
    <ModulePage
      eyebrow="예배 / 콘텐츠"
      title="예배 콘텐츠"
      description="사진, 영상, PPT, 배경 자료를 관리하는 저장 공간입니다."
      highlights={[
        "예배 입력용 자료 관리",
        "자주 쓰는 미디어 분류",
        "파일과 메타데이터 분리 관리",
      ]}
      actions={[
        { href: "/worship/orders", label: "예배 순서", variant: "secondary" },
      ]}
    />
  );
}
