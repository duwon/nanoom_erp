import { ModulePage } from "@/components/module-page";
import { DocumentContainer } from "@/components/udms/document-container";

export default function WorshipSubtitlesInputPage() {
  return (
    <ModulePage
      eyebrow="Worship / Subtitle"
      title="Subtitle Input"
      description="Subtitle documents can be managed through UDMS with the SubtitleContent target type."
      highlights={[
        "Use targetType=SubtitleContent",
        "Revision history stays inside UDMS",
        "Output screens can consume the same target context later",
      ]}
      actions={[{ href: "/worship/subtitles/output", label: "Subtitle Output", variant: "secondary" }]}
    >
      <DocumentContainer targetType="SubtitleContent" targetId="" title="Subtitle Documents" />
    </ModulePage>
  );
}
