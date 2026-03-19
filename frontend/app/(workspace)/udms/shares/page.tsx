import { ModulePage } from "@/components/module-page";

export default function UdmsSharesPage() {
  return (
    <ModulePage
      eyebrow="문서 관리 / 공유"
      title="문서 공유"
      description="문서 공유는 읽기, 편집, 부서 단위로 분리해 관리합니다."
      highlights={[
        "읽기와 편집 공유 구분",
        "부서 단위 공유 가능",
        "추후 링크 공유 확장 대비",
      ]}
      actions={[
        { href: "/udms/documents", label: "문서 목록", variant: "secondary" },
      ]}
    />
  );
}
