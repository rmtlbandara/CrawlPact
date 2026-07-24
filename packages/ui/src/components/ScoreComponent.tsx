import { cx } from "../cx";

export type ScoreValue =
  { state: "scored"; value: number; label: string } | { state: "incomplete" };

export type ScoreComponentProps = {
  score: ScoreValue;
  categoryBreakdown?: { label: string; value: number }[];
  methodologyHref?: string;
};

function toneForScore(value: number): "success" | "warning" | "error" | "critical" {
  if (value >= 75) return "success";
  if (value >= 50) return "warning";
  if (value >= 25) return "error";
  return "critical";
}

const TONE_BAR_CLASSES: Record<string, string> = {
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
  critical: "bg-critical",
};

/**
 * Policy Health Score foundation (SRS §10.24). Deliberately a horizontal
 * band, not a speedometer gauge, per the SRS's explicit instruction against
 * implying false precision. Renders "Incomplete" rather than a misleading
 * number when evidence is insufficient.
 */
export function ScoreComponent({ score, categoryBreakdown, methodologyHref }: ScoreComponentProps) {
  if (score.state === "incomplete") {
    return (
      <div className="rounded-card border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-h3 text-neutral-700">Incomplete</p>
        <p className="mt-1 text-supporting text-neutral-600">
          There is not yet enough evidence to calculate a reliable score for this scan.
        </p>
      </div>
    );
  }

  const tone = toneForScore(score.value);

  return (
    <div className="rounded-card border border-neutral-200 bg-white p-4">
      <div className="flex items-baseline gap-2">
        <span className="text-display text-neutral-950">{score.value}</span>
        <span className="text-body text-neutral-500">/ 100</span>
        <span className="text-body font-medium text-neutral-800">{score.label}</span>
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-pill bg-neutral-100"
        role="img"
        aria-label={`Policy Health Score: ${score.value} out of 100, ${score.label}`}
      >
        <div
          className={cx("h-full", TONE_BAR_CLASSES[tone])}
          style={{ width: `${score.value}%` }}
        />
      </div>
      {categoryBreakdown && (
        <ul className="mt-4 flex flex-col gap-2">
          {categoryBreakdown.map((category) => (
            <li
              key={category.label}
              className="flex items-center justify-between text-supporting text-neutral-700"
            >
              <span>{category.label}</span>
              <span className="font-medium">{category.value}</span>
            </li>
          ))}
        </ul>
      )}
      {methodologyHref && (
        <a
          href={methodologyHref}
          className="mt-3 inline-block text-supporting text-brand-700 underline-offset-2 hover:underline"
        >
          How this score is calculated
        </a>
      )}
    </div>
  );
}
