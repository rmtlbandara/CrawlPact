import { ScoreComponent, StatusChip } from "@crawlpact/ui";
import { CRAWLER_PURPOSE_LABELS, type CrawlerPurpose } from "@crawlpact/registry";
import type { StatusTone } from "@crawlpact/ui";

type PreviewRow = {
  name: string;
  operator: string;
  purpose: CrawlerPurpose;
  result: StatusTone;
  label: string;
};

const ROWS: PreviewRow[] = [
  {
    name: "OAI-SearchBot",
    operator: "OpenAI",
    purpose: "search",
    result: "success",
    label: "Allowed",
  },
  {
    name: "GPTBot",
    operator: "OpenAI",
    purpose: "training",
    result: "warning",
    label: "No explicit rule",
  },
  {
    name: "ClaudeBot",
    operator: "Anthropic",
    purpose: "training",
    result: "error",
    label: "Blocked",
  },
  {
    name: "Google-Extended",
    operator: "Google",
    purpose: "training",
    result: "success",
    label: "Allowed",
  },
];

/**
 * Single hydration island for the whole landing-page report preview (SRS
 * §9.10) — kept as one component rather than several so the page ships one
 * small script instead of five (SRS §9.22: "minimise JavaScript"). The data
 * below is a clearly labelled synthetic demonstration, never a real scan
 * (see the surrounding markup in index.astro and docs/status/KNOWN_RISKS.md).
 */
export function ReportPreview() {
  return (
    <div className="grid gap-6 md:grid-cols-[280px_1fr]">
      <ScoreComponent
        score={{ state: "scored", value: 68, label: "Needs attention" }}
        categoryBreakdown={[
          { label: "Resource availability", value: 90 },
          { label: "Syntax & evaluation", value: 85 },
          { label: "Objective alignment", value: 45 },
          { label: "Cross-signal consistency", value: 70 },
        ]}
        methodologyHref="/scoring"
      />
      <div className="flex flex-col gap-3">
        {ROWS.map((row) => (
          <div
            key={row.name}
            className="flex items-center justify-between gap-4 rounded-control border border-neutral-200 px-3 py-2.5"
          >
            <div>
              <p className="text-body font-medium text-neutral-900">{row.name}</p>
              <p className="text-supporting text-neutral-500">
                {row.operator} &middot; {CRAWLER_PURPOSE_LABELS[row.purpose]}
              </p>
            </div>
            <StatusChip tone={row.result} label={row.label} />
          </div>
        ))}
      </div>
    </div>
  );
}
