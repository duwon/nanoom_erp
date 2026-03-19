import { ModulePage } from "@/components/module-page";

export default function AdminBoardsPage() {
  return (
    <ModulePage
      eyebrow="Admin / Boards"
      title="게시판 관리"
      description="게시판은 UDMS의 진입점이자 문서 노출 규칙의 기준입니다."
      highlights={[
        "게시판 활성화/비활성화",
        "문서 연결 기준 정리",
        "향후 카테고리와 접근권한 연결",
      ]}
      actions={[
        { href: "/udms/documents", label: "UDMS 문서", variant: "secondary" },
        { href: "/admin", label: "관리자 홈" },
      ]}
    />
  );
}
