import { ModulePage } from "@/components/module-page";

export default function UdmsSharesPage() {
  return (
    <ModulePage
      eyebrow="UDMS / Shares"
      title="문서 공유"
      description="문서 공유는 사람, 부서, 역할 단위로 분리되어야 합니다."
      highlights={[
        "읽기/편집 공유 구분",
        "부서 단위 공유 가능",
        "향후 외부 링크 공유 확장",
      ]}
      actions={[
        { href: "/udms/documents", label: "문서 목록", variant: "secondary" },
      ]}
    />
  );
}
