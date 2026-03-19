import { ModulePage } from "@/components/module-page";

export default function WorshipContentsPage() {
  return (
    <ModulePage
      eyebrow="Worship / Contents"
      title="자막 컨텐츠"
      description="찬양 전광판, 인도자 모니터, 배경 영상, PPT, 설교자료를 묶는 저장소입니다."
      highlights={[
        "자막 입력 시 불러오기",
        "재사용 가능한 미디어 자산",
        "파일과 메타데이터 분리 관리",
      ]}
      actions={[
        { href: "/worship/orders", label: "예배 순서", variant: "secondary" },
      ]}
    />
  );
}
