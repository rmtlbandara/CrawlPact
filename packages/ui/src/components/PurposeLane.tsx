import { StatusChip } from "./StatusChip";
import type { StatusTone } from "./StatusChip";

export type PurposeLaneEntry = {
  /** e.g. "Search", "Training", "User-triggered retrieval", "Agents", "Other". */
  purpose: string;
  tone: StatusTone;
  /** Real, caller-supplied summary, e.g. "3 of 4 crawlers allowed". Never fabricated. */
  summary: string;
};

export type PurposeLaneProps = {
  entries: PurposeLaneEntry[];
};

/**
 * Evidence Observatory purpose-based summary (docs/design/EVIDENCE_OBSERVATORY_REDESIGN_SPEC.md
 * §4C). A presentational complement to the existing accessible per-crawler data table — this
 * must never replace that table where a table is the clearest format (source redesign brief §3,
 * "Signature design patterns", item B). Status is never colour-only: each lane renders a
 * StatusChip, which always pairs its tone with a text label.
 */
export function PurposeLane({ entries }: PurposeLaneProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {entries.map((entry) => (
        <div
          key={entry.purpose}
          className="min-w-[10rem] rounded-card border border-neutral-200 bg-white p-3"
        >
          <p className="text-card-heading text-neutral-950">{entry.purpose}</p>
          <div className="mt-2">
            <StatusChip tone={entry.tone} label={entry.summary} />
          </div>
        </div>
      ))}
    </div>
  );
}
