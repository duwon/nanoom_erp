import { ModulePage } from "@/components/module-page";

export default function UdmsBoardsPage() {
  return (
    <ModulePage
      eyebrow="문서 관리 / 게시판"
      title="게시판"
      description="게시판은 문서와 공지, 공유 규칙을 연결하는 공간입니다."
      highlights={[
        "공지, 문서, 공유의 기준 단위",
        "권한별 게시판 노출",
        "추후 분류 확장에 대응",
      ]}
      actions={[
        { href: "/udms/documents", label: "문서 목록", variant: "secondary" },
        { href: "/admin/boards", label: "관리자 게시판", variant: "secondary" },
      ]}
    />
  );
}
