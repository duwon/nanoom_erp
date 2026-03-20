import { ModulePage } from "@/components/module-page";
import { DocumentContainer } from "@/components/udms/document-container";

export default function WorshipOrdersPage() {
  return (
    <ModulePage
      eyebrow="Worship / Orders"
      title="Worship Orders"
      description="Worship order documents can now live in UDMS as target-bound records instead of separate board entries."
      highlights={[
        "Use targetType=WorshipOrder",
        "The same revision and ACL model applies here",
        "Order-specific UI can bind a concrete targetId later",
      ]}
      actions={[
        { href: "/worship/subtitles/input", label: "Subtitle Input", variant: "secondary" },
        { href: "/worship/subtitles/output", label: "Subtitle Output", variant: "secondary" },
      ]}
    >
      <DocumentContainer targetType="WorshipOrder" targetId="" title="Worship Order Documents" />
    </ModulePage>
  );
}
