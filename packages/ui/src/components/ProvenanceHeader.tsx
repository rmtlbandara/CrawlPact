import { StatusChip } from "./StatusChip";
import type { StatusTone } from "./StatusChip";

export type ProvenanceHeaderField = {
  label: string;
  /** `null` renders an honest "Not available" state — never omitted or fabricated. */
  value: string | null;
};

export type ProvenanceHeaderProps = {
  domain: string;
  reportState: { tone: StatusTone; label: string };
  fields: ProvenanceHeaderField[];
  /** Optional disclosure line, e.g. shared-report or agency-branding context. */
  context?: string;
};

/**
 * Evidence Observatory provenance area (docs/design/EVIDENCE_OBSERVATORY_REDESIGN_SPEC.md §4A).
 * Makes a report's origin traceable: domain, report state, and a caller-supplied list of real
 * metadata fields (scan time, registry version, ruleset version, preset, etc). Every field value
 * is either real data or an explicit "Not available" — never a fabricated placeholder.
 */
export function ProvenanceHeader({ domain, reportState, fields, context }: ProvenanceHeaderProps) {
  return (
    <div className="rounded-card border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-h3 text-neutral-950">{domain}</p>
        <StatusChip tone={reportState.tone} label={reportState.label} />
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 border-t border-neutral-100 pt-3">
        {fields.map((field) => (
          <div key={field.label} className="min-w-[8rem]">
            <dt className="text-metadata font-medium uppercase tracking-wide text-neutral-500">
              {field.label}
            </dt>
            <dd className="mt-0.5 text-supporting text-neutral-800">
              {field.value ?? <span className="text-neutral-500">Not available</span>}
            </dd>
          </div>
        ))}
      </dl>
      {context && <p className="mt-3 text-supporting text-neutral-600">{context}</p>}
    </div>
  );
}
