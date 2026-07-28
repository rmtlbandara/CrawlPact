import type { ReactNode } from "react";

export type EvidenceRailItem = {
  /** What CrawlPact retrieved or detected. */
  observed: ReactNode | null;
  /** What the deterministic rules concluded. */
  interpretation: ReactNode | null;
  /** What this means for the user. */
  impact: ReactNode | null;
  /** What the user may consider changing. Never phrased as certain. */
  action: ReactNode | null;
  /** Source files, directives, HTTP evidence, or registry references. */
  evidence: ReactNode | null;
};

export type EvidenceRailProps = {
  title: string;
  item: EvidenceRailItem;
};

const STEPS: { key: keyof EvidenceRailItem; label: string }[] = [
  { key: "observed", label: "Observed" },
  { key: "interpretation", label: "Interpretation" },
  { key: "impact", label: "User impact" },
  { key: "action", label: "Recommended action" },
  { key: "evidence", label: "Supporting evidence" },
];

/**
 * Evidence Observatory finding structure (docs/design/EVIDENCE_OBSERVATORY_REDESIGN_SPEC.md §4B).
 * Connects one finding's observed signal through to a recommended action, with the supporting
 * evidence kept alongside rather than hidden behind a separate tab. A step with no real data
 * renders an explicit "Not available for this finding" rather than a silent gap.
 */
export function EvidenceRail({ title, item }: EvidenceRailProps) {
  return (
    <div className="rounded-card border border-neutral-200 bg-white p-4">
      <p className="text-card-heading text-neutral-950">{title}</p>
      <ol className="mt-3 flex flex-col gap-3 border-l-2 border-neutral-200 pl-4">
        {STEPS.map(({ key, label }) => (
          <li key={key}>
            <p className="text-metadata font-medium uppercase tracking-wide text-neutral-500">
              {label}
            </p>
            <div className="mt-0.5 text-body text-neutral-800">
              {item[key] ?? (
                <span className="text-neutral-500">Not available for this finding</span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
