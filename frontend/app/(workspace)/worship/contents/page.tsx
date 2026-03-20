import { ModulePage } from "@/components/module-page";
import { DocumentContainer } from "@/components/udms/document-container";

export default function WorshipContentsPage() {
  return (
    <ModulePage
      eyebrow="Worship / Content"
      title="Worship Content"
      description="Worship assets and content references can be represented as UDMS documents under the WorshipContent target type."
      highlights={[
        "Use targetType=WorshipContent",
        "Documents carry attachments, metadata, and ACL",
        "Target-specific modules can still layer UI on top",
      ]}
      actions={[{ href: "/worship/orders", label: "Worship Orders", variant: "secondary" }]}
    >
      <DocumentContainer targetType="WorshipContent" targetId="" title="Worship Content Documents" />
    </ModulePage>
  );
}
