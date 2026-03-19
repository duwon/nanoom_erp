import { ModulePage } from "@/components/module-page";

export default function UdmsBoardsPage() {
  return (
    <ModulePage
      eyebrow="UDMS / Boards"
      title="게시판"
      description="게시판은 문서와 알림, 공유 정책을 묶는 공간입니다."
      highlights={[
        "공지/문서/공유의 기준 단위",
        "권한별 게시판 노출",
        "후속 모듈 추가 시 확장 가능",
      ]}
      actions={[
        { href: "/udms/documents", label: "문서 목록", variant: "secondary" },
        { href: "/admin/boards", label: "관리자 게시판", variant: "secondary" },
      ]}
    />
  );
}
