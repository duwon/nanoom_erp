import { ModulePage } from "@/components/module-page";
import { DocumentContainer } from "@/components/udms/document-container";

export default function WorshipSubtitlesOutputPage() {
  return (
    <ModulePage
      eyebrow="Worship / Subtitle"
      title="Subtitle Output"
      description="The live subtitle output flow can read from the same SubtitleContent document space used by input screens."
      highlights={[
        "Same document set as subtitle input",
        "Output remains a downstream consumer",
        "Presentation wiring can be added without changing UDMS core",
      ]}
      actions={[{ href: "/display", label: "Display Screen", variant: "secondary" }]}
    >
      <DocumentContainer targetType="SubtitleContent" targetId="" title="Subtitle Output Sources" />
    </ModulePage>
  );
}
