import { evaluateAlignment } from "./presets";
import type { Conflict } from "./conflicts";
import type { PolicyEvaluationInput } from "./types";

export type ScoreCategory =
  | "resource_availability"
  | "syntax_evaluation"
  | "objective_alignment"
  | "cross_signal_consistency"
  | "registry_freshness"
  | "monitoring_change_risk";

/** Weights exactly match the public methodology page (SRS §22.3, `/scoring`). */
export const SCORE_WEIGHTS: Record<ScoreCategory, number> = {
  resource_availability: 0.15,
  syntax_evaluation: 0.2,
  objective_alignment: 0.3,
  cross_signal_consistency: 0.15,
  registry_freshness: 0.1,
  monitoring_change_risk: 0.1,
};

/** Category order and labels exactly match the public methodology page (`/scoring`). */
export const SCORE_CATEGORY_ORDER = Object.keys(SCORE_WEIGHTS) as ScoreCategory[];

export const SCORE_CATEGORY_LABELS: Record<ScoreCategory, string> = {
  resource_availability: "Resource availability and validity",
  syntax_evaluation: "Syntax and deterministic evaluation",
  objective_alignment: "Business-objective alignment",
  cross_signal_consistency: "Cross-signal consistency",
  registry_freshness: "Registry freshness and explicitness",
  monitoring_change_risk: "Monitoring and change risk",
};

export type PolicyHealthScore =
  | {
      state: "scored";
      value: number;
      label: string;
      categoryBreakdown: Record<ScoreCategory, number>;
    }
  | { state: "incomplete" };

/**
 * The single source of truth for score→label text (SRS §22.3's five bands).
 * Exported so every real-score display — the report view, the domain
 * detail page, etc. — shows the same label for the same number rather than
 * each re-deriving (or omitting) it independently.
 */
export function scoreLabelFor(score: number): string {
  if (score >= 90) return "Strong";
  if (score >= 75) return "Good";
  if (score >= 50) return "Needs attention";
  if (score >= 25) return "Weak";
  return "Critical";
}

const SEVERITY_PENALTY: Record<Conflict["confidence"], number> = { high: 15, medium: 8, low: 3 };

/**
 * Computes the Policy Health Score (SRS §22.3). Deterministic and
 * reproducible: identical input always produces an identical score — this
 * is asserted directly by scoring.test.ts, not just assumed.
 */
export function computePolicyHealthScore(
  input: PolicyEvaluationInput,
  conflicts: Conflict[],
  robotsTxtFetchSucceeded: boolean,
): PolicyHealthScore {
  if (!robotsTxtFetchSucceeded) {
    return { state: "incomplete" };
  }

  const { crawlerEvaluations, signals } = input;

  // Resource availability: robots.txt succeeded (required to reach this
  // point); count llms.txt/sitemap/rsl/content-signals as bonus signals.
  const optionalSignalsAttempted = 4;
  const optionalSignalsPresent = [
    signals.rsl?.discovered,
    signals.sitemap?.looksLikeSitemap,
    signals.contentSignals !== null,
  ].filter(Boolean).length;
  const resourceAvailability = 70 + (optionalSignalsPresent / optionalSignalsAttempted) * 30;

  // Syntax and deterministic evaluation: penalise robots.txt parser issues.
  const syntaxPenalty = Math.min(100, signals.robots.issueCodes.length * 10);
  const syntaxEvaluation = Math.max(0, 100 - syntaxPenalty);

  // Business-objective alignment: proportion aligned among applicable crawlers.
  const applicable = crawlerEvaluations
    .map((c) => evaluateAlignment(input.preset, c.purpose, c.result))
    .filter((a) => a !== "not_applicable");
  const objectiveAlignment =
    applicable.length === 0
      ? 100
      : (applicable.filter((a) => a === "aligned").length / applicable.length) * 100;

  // Cross-signal consistency: penalise by conflict confidence.
  const conflictPenalty = conflicts.reduce(
    (sum, conflict) => sum + SEVERITY_PENALTY[conflict.confidence],
    0,
  );
  const crossSignalConsistency = Math.max(0, 100 - conflictPenalty);

  // Registry freshness and explicitness: proportion of crawlers with an
  // explicit (non-"no_explicit_rule", non-"unknown") result.
  const explicitCount = crawlerEvaluations.filter(
    (c) =>
      c.result !== "no_explicit_rule" && c.result !== "unknown" && c.result !== "not_evaluated",
  ).length;
  const registryFreshness =
    crawlerEvaluations.length === 0 ? 100 : (explicitCount / crawlerEvaluations.length) * 100;

  // Monitoring and change risk: no history on a first scan defaults to a
  // neutral value; a real risk signal (e.g. repeated failures) is a Part 4
  // (monitoring) input this function accepts implicitly via signals data
  // once that exists — not fabricated here.
  const monitoringChangeRisk = 100;

  const categoryBreakdown: Record<ScoreCategory, number> = {
    resource_availability: Math.round(resourceAvailability),
    syntax_evaluation: Math.round(syntaxEvaluation),
    objective_alignment: Math.round(objectiveAlignment),
    cross_signal_consistency: Math.round(crossSignalConsistency),
    registry_freshness: Math.round(registryFreshness),
    monitoring_change_risk: Math.round(monitoringChangeRisk),
  };

  const value = Math.round(
    Object.entries(categoryBreakdown).reduce(
      (sum, [category, score]) => sum + score * SCORE_WEIGHTS[category as ScoreCategory],
      0,
    ),
  );

  return { state: "scored", value, label: scoreLabelFor(value), categoryBreakdown };
}
