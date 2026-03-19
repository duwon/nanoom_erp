import { ModulePage } from "@/components/module-page";

export default function AdminBoardsPage() {
  return (
    <ModulePage
      eyebrow="관리자 / 게시판"
      title="게시판 관리"
      description="게시판은 문서 관리의 진입점이자 문서 노출 규칙의 기준이 됩니다."
      highlights={[
        "게시판 활성화와 비활성화",
        "문서 연결 기준 정리",
        "카테고리와 권한의 연결",
      ]}
      actions={[
        { href: "/udms/documents", label: "문서 관리", variant: "secondary" },
        { href: "/admin", label: "관리자 홈", variant: "secondary" },
      ]}
    />
  );
}
