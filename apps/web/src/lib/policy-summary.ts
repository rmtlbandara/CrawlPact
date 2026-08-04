import type { AuditReportResponse, CrawlerMatrixRow } from "@crawlpact/core";

/**
 * Deterministic executive policy-impact summary derived from an already-computed report (Phase
 * 5, SRS-adjacent product requirement, not an SRS section). Pure display derivation — reads
 * already-persisted crawlerMatrix/findings/score fields, never re-evaluates robots.txt or
 * recomputes a score. See docs/product/ANONYMOUS_REPORT_POLICY_SUMMARY_MAPPING.md for the full
 * rationale and worked examples; keep this file and that document in sync.
 */

export type PolicySummaryLabel =
  | "No explicit issue detected"
  | "Attention recommended"
  | "At risk"
  | "Explicitly allowed"
  | "Explicitly restricted"
  | "Mixed"
  | "Unspecified"
  | "Unable to determine"
  | "No conflict detected"
  | "Conflict detected"
  | "Incomplete evidence"
  | "Not enabled";

export type PolicySummary = {
  aiSearchDiscoverability: PolicySummaryLabel;
  trainingPolicyDeclaration: PolicySummaryLabel;
  userTriggeredRetrieval: PolicySummaryLabel;
  agentAccess: PolicySummaryLabel;
  crossSignalConsistency: PolicySummaryLabel;
  monitoring: PolicySummaryLabel;
};

const UNEVALUATED_RESULTS = new Set(["unknown", "not_evaluated", "resource_unavailable"]);

const CONFLICT_CODES = new Set([
  "SEARCH_VISIBILITY_CONFLICT",
  "TRAINING_RESTRICTION_CONFLICT",
  "RSL_CONTENT_SIGNALS_DISAGREEMENT",
  "HEADER_SITE_DISAGREEMENT",
]);

const INCOMPLETE_EVIDENCE_CODES = new Set([
  "PAGE_DIRECTIVE_UNREACHABLE",
  "UNKNOWN_PURPOSE_REQUIRES_REVIEW",
]);

function classifyByPurpose(
  rows: CrawlerMatrixRow[],
  purpose: CrawlerMatrixRow["purpose"],
  labels: {
    allowed: PolicySummaryLabel;
    restricted: PolicySummaryLabel;
    mixed: PolicySummaryLabel;
  },
): PolicySummaryLabel {
  const evaluated = rows
    .filter((row) => row.purpose === purpose)
    .filter((row) => !UNEVALUATED_RESULTS.has(row.result));
  if (evaluated.length === 0) return "Unable to determine";

  const hasAllowed = evaluated.some((row) => row.result === "allowed");
  const hasBlocked = evaluated.some((row) => row.result === "blocked");
  const hasMixed = evaluated.some((row) => row.result === "mixed");

  if (hasMixed || (hasAllowed && hasBlocked)) return labels.mixed;
  if (hasBlocked) return labels.restricted;
  if (hasAllowed) return labels.allowed;
  return "Unspecified";
}

function classifyCrossSignalConsistency(report: AuditReportResponse): PolicySummaryLabel {
  if (report.score.state === "incomplete" && report.crawlerMatrix.length === 0) {
    return "Unable to determine";
  }
  const findingCodes = new Set(report.findings.map((f) => f.code));
  const hasConflict = [...findingCodes].some((code) => CONFLICT_CODES.has(code));
  if (hasConflict) return "Conflict detected";

  const hasIncompleteFinding = [...findingCodes].some((code) =>
    INCOMPLETE_EVIDENCE_CODES.has(code),
  );
  const hasUnevaluatedRow = report.crawlerMatrix.some((row) => UNEVALUATED_RESULTS.has(row.result));
  if (hasIncompleteFinding || hasUnevaluatedRow) return "Incomplete evidence";

  return "No conflict detected";
}

/**
 * Which of the six contextual conversion-CTA messages (Phase 5, prompt §10) a report earns.
 * Priority order, most urgent first — a report can match several conditions at once, and only
 * the highest-priority one is shown, so this list is a strict waterfall, not independent checks:
 *   1. conflict_detected     — signals actively disagree with each other
 *   2. registry_uncertainty  — the scan itself couldn't be verified against a known registry
 *   3. search_risk           — AI search discoverability looks restricted or mixed
 *   4. incomplete_evidence   — cross-signal consistency couldn't be fully established
 *   5. training_unspecified  — no explicit AI-training position was declared
 *   6. clean_baseline        — none of the above; the default, reassuring case
 */
export type ConversionCtaVariant =
  | "conflict_detected"
  | "registry_uncertainty"
  | "search_risk"
  | "incomplete_evidence"
  | "training_unspecified"
  | "clean_baseline";

export type ConversionCtaCopy = {
  variant: ConversionCtaVariant;
  headline: string;
  body: string;
};

const CONVERSION_CTA_COPY: Record<ConversionCtaVariant, Omit<ConversionCtaCopy, "variant">> = {
  conflict_detected: {
    headline: "This site has conflicting AI crawler signals",
    body: "Different policy signals disagree about crawler access. Save this domain to track changes and get notified if the conflict is resolved — or gets worse.",
  },
  registry_uncertainty: {
    headline: "This result could not be fully verified",
    body: "This scan couldn't be checked against a confirmed crawler registry release. Save this domain to get a freshly verified result and ongoing monitoring.",
  },
  search_risk: {
    headline: "AI search visibility may be at risk",
    body: "Some AI search crawlers appear restricted or inconsistently handled. Save this domain to monitor for changes to your search visibility.",
  },
  incomplete_evidence: {
    headline: "This report is incomplete",
    body: "Some policy resources couldn't be fully checked. Save this domain to re-run a complete scan and monitor it going forward.",
  },
  training_unspecified: {
    headline: "No explicit AI-training policy was declared",
    body: "This site hasn't stated a position on AI training use. Save this domain to track whether that changes.",
  },
  clean_baseline: {
    headline: "This looks healthy — keep it that way",
    body: "No issues were found in this scan. Save this domain and enable monitoring so you're alerted if anything changes.",
  },
};

export function deriveConversionCtaCopy(
  report: AuditReportResponse,
  summary: PolicySummary,
): ConversionCtaCopy {
  let variant: ConversionCtaVariant;
  if (summary.crossSignalConsistency === "Conflict detected") {
    variant = "conflict_detected";
  } else if (!report.registryVersion || !report.rulesetVersion) {
    variant = "registry_uncertainty";
  } else if (
    summary.aiSearchDiscoverability === "At risk" ||
    summary.aiSearchDiscoverability === "Attention recommended"
  ) {
    variant = "search_risk";
  } else if (
    summary.crossSignalConsistency === "Incomplete evidence" ||
    summary.crossSignalConsistency === "Unable to determine"
  ) {
    variant = "incomplete_evidence";
  } else if (
    summary.trainingPolicyDeclaration === "Unspecified" ||
    summary.trainingPolicyDeclaration === "Unable to determine"
  ) {
    variant = "training_unspecified";
  } else {
    variant = "clean_baseline";
  }

  return { variant, ...CONVERSION_CTA_COPY[variant] };
}

export function computePolicySummary(report: AuditReportResponse): PolicySummary {
  const findingCodes = new Set(report.findings.map((f) => f.code));

  let aiSearchDiscoverability = classifyByPurpose(report.crawlerMatrix, "search", {
    allowed: "No explicit issue detected",
    restricted: "At risk",
    mixed: "Attention recommended",
  });
  // Upgrade-only: a real detected search conflict is stronger evidence than the raw per-crawler
  // matrix alone, but never downgrades a worse classification back toward "no issue detected".
  if (
    findingCodes.has("SEARCH_VISIBILITY_CONFLICT") &&
    aiSearchDiscoverability === "No explicit issue detected"
  ) {
    aiSearchDiscoverability = "Attention recommended";
  }

  return {
    aiSearchDiscoverability,
    trainingPolicyDeclaration: classifyByPurpose(report.crawlerMatrix, "training", {
      allowed: "Explicitly allowed",
      restricted: "Explicitly restricted",
      mixed: "Mixed",
    }),
    userTriggeredRetrieval: classifyByPurpose(report.crawlerMatrix, "user_triggered", {
      allowed: "Explicitly allowed",
      restricted: "Explicitly restricted",
      mixed: "Mixed",
    }),
    agentAccess: classifyByPurpose(report.crawlerMatrix, "agent", {
      allowed: "Explicitly allowed",
      restricted: "Explicitly restricted",
      mixed: "Mixed",
    }),
    crossSignalConsistency: classifyCrossSignalConsistency(report),
    monitoring: "Not enabled",
  };
}
