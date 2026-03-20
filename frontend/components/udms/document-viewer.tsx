import type { DocumentRevision } from "@/lib/types";

type DocumentViewerProps = {
  revision: DocumentRevision;
};

export function DocumentViewer({ revision }: DocumentViewerProps) {
  return (
    <section className="panel rounded-[28px] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
        Revision v{revision.version}
      </p>
      <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900">
        {revision.header.title}
      </h2>
      <div
        className="mt-5 rounded-[24px] border border-slate-200 bg-white px-5 py-4 text-sm leading-7 text-slate-700"
        dangerouslySetInnerHTML={{ __html: revision.body ?? "<p></p>" }}
      />
    </section>
  );
}
