import type { RegistryObservatorySnapshot } from "../observatory/registry-observatory";
import {
  BANNED_CLAIM_PATTERNS,
  POLICY_OBSERVATORY_METHODOLOGY_VERSION,
  TREND_MIN_COMPARABLE_RUNS,
} from "./methodology";

/**
 * Phase 16 §77 — every key finding must carry its own numerator,
 * denominator and scope so a reader can never mistake a bounded count for a
 * web-wide claim. `denominator === 0` means "insufficient basis", not "0%".
 */
export type ResearchPublicationKeyFinding = {
  label: string;
  numerator: number;
  denominator: number;
  scope: string;
};

export type ResearchPublicationSection = { heading: string; body: string };

/** The full deterministic, code-generated publication body stored in
 * `research_publications.content_json`. Every field here must be derivable
 * from `registryVersionId` alone — no hand-typed statistics (§52). */
export type ResearchPublicationContent = {
  title: string;
  summary: string;
  methodologyVersion: string;
  registryVersionId: string;
  registryVersionLabel: string;
  generatedAt: string;
  keyFindings: ResearchPublicationKeyFinding[];
  sections: ResearchPublicationSection[];
  limitations: string[];
  correctionLog: { date: string; what: string; why: string; conclusionsChanged: boolean }[];
};

function purposeLabel(purpose: string): string {
  return purpose.replace(/_/g, " ");
}

/**
 * The subset of publication content the checksum is computed over —
 * excludes `generatedAt` (a wall-clock timestamp that legitimately differs
 * between the original computation and any later reproduction, even when
 * every underlying metric is identical) and `correctionLog` (operator-
 * authored commentary, not a reproducible metric). Hashing the full object
 * including these fields would make the checksum spuriously unstable, which
 * would defeat §199's reproducibility guarantee. Used consistently by every
 * checksum computation/verification site (admin/research.ts,
 * scripts/research-tools.mjs).
 */
export function getChecksumSubset(
  content: ResearchPublicationContent,
): Omit<ResearchPublicationContent, "generatedAt" | "correctionLog"> {
  const { generatedAt: _generatedAt, correctionLog: _correctionLog, ...rest } = content;
  return rest;
}

/**
 * Builds the "AI Crawler Registry Landscape" publication content
 * deterministically from a Registry Observatory snapshot — the first
 * recommended Phase 16 publication (§75), using only Phase 15 registry data,
 * no customer websites.
 */
export function buildRegistryLandscapeContent(
  observatory: RegistryObservatorySnapshot,
): ResearchPublicationContent {
  const findings: ResearchPublicationKeyFinding[] = [];

  findings.push({
    label: `${observatory.evaluationEligibleCount} of ${observatory.crawlerCount} tracked crawler records are currently evaluation-eligible (active, deprecated, or replaced lifecycle status)`,
    numerator: observatory.evaluationEligibleCount,
    denominator: observatory.crawlerCount,
    scope: `Registry release ${observatory.versionLabel}`,
  });

  for (const [purpose, count] of Object.entries(observatory.purposeDistribution).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    findings.push({
      label: `${count} of ${observatory.crawlerCount} tracked crawler records are classified with purpose "${purposeLabel(purpose)}"`,
      numerator: count,
      denominator: observatory.crawlerCount,
      scope: `Registry release ${observatory.versionLabel}`,
    });
  }

  findings.push({
    label: `${observatory.verification.verifiedCount} of ${observatory.crawlerCount} tracked crawler records carry a recorded source-verification date`,
    numerator: observatory.verification.verifiedCount,
    denominator: observatory.crawlerCount,
    scope: `Registry release ${observatory.versionLabel}`,
  });

  findings.push({
    label:
      observatory.evaluationEligibleCount > 0
        ? `${observatory.verification.reviewDueCount} of ${observatory.evaluationEligibleCount} evaluation-eligible crawler records are due for re-verification (never verified, or last verified more than 180 days ago)`
        : "No evaluation-eligible crawler records exist in this release",
    numerator: observatory.verification.reviewDueCount,
    denominator: observatory.evaluationEligibleCount,
    scope: `Registry release ${observatory.versionLabel}`,
  });

  findings.push({
    label: `${observatory.operatorCount} distinct operators are represented across ${observatory.crawlerCount} tracked crawler records`,
    numerator: observatory.operatorCount,
    denominator: observatory.crawlerCount,
    scope: `Registry release ${observatory.versionLabel}`,
  });

  const latestChange = observatory.releaseHistory[0] ?? null;
  const releaseHistorySection =
    observatory.totalReleases <= 1 || !latestChange
      ? "This is the first published registry release recorded in this dataset; there is no prior release to compare against, so no change-over-time claim is made."
      : `${observatory.totalReleases} registry releases have been published in total. The most recent published release ` +
        `("${latestChange.versionLabel}") recorded ${latestChange.added} crawler addition(s), ${latestChange.removed} removal(s), ` +
        `${latestChange.purposeChanges} purpose reclassification(s), ${latestChange.tokenChanges} token-identity change(s), and ` +
        `${latestChange.evidenceOnlyChanges} evidence-only source correction(s) (no evaluation impact) relative to the previous release. ` +
        `Fewer than ${TREND_MIN_COMPARABLE_RUNS} comparable releases exist, so this is reported as a single change-since-previous-release observation, not a trend.`;

  const sections: ResearchPublicationSection[] = [
    {
      heading: "Dataset",
      body: `Every figure in this publication is computed directly from CrawlPact's immutable registry release "${observatory.versionLabel}" (id ${observatory.registryVersionId}), published ${observatory.publishedAt ?? "unknown date"}. No customer domains, saved-domain portfolios, Agency client portfolios, anonymous audits, or product analytics data are used. This dataset is CrawlPact's own crawler-identity registry, not a sample of the web.`,
    },
    {
      heading: "Methodology",
      body: `Methodology version ${POLICY_OBSERVATORY_METHODOLOGY_VERSION}. Counts are drawn from every crawler entry recorded in the pinned registry release's immutable snapshot (registry_version_entries), resolved via the same read path production evaluation and historical scan rendering use — never from the live, mutable crawlers table. See docs/research/RESEARCH_METHODOLOGY.md and docs/registry/PHASE_15_FULL_SOURCE_REVERIFICATION_REPORT.md for how each underlying crawler record was itself verified.`,
    },
    { heading: "Results", body: releaseHistorySection },
    {
      heading: "Registry/ruleset provenance",
      body: `Registry version: ${observatory.versionLabel} (checksum: ${observatory.checksum ?? "not computed for this release"}). This publication does not evaluate customer policy data, so no ruleset version applies.`,
    },
  ];

  const limitations = [
    "This publication describes CrawlPact's own crawler-identity registry, not a survey or sample of live websites — it does not measure how many websites block or allow any crawler.",
    "Purpose classification reflects each operator's own published documentation as independently reverified by CrawlPact; it does not measure or predict actual crawler behaviour.",
    "Registry release counts reflect what CrawlPact has verified and published — an operator may run undocumented or unverified crawlers not yet reflected here.",
    "Verification-freshness figures describe when CrawlPact last reverified a source, not whether the underlying operator documentation has since changed without CrawlPact's knowledge.",
  ];

  return {
    title: `AI Crawler Registry Landscape — ${new Date(observatory.generatedAt).toLocaleString("en-US", { month: "long", year: "numeric" })}`,
    summary: `A source-backed snapshot of CrawlPact's verified AI-crawler registry as of release ${observatory.versionLabel}: ${observatory.crawlerCount} tracked crawler records across ${observatory.operatorCount} operators, classified by purpose, lifecycle status, and source-verification freshness.`,
    methodologyVersion: POLICY_OBSERVATORY_METHODOLOGY_VERSION,
    registryVersionId: observatory.registryVersionId,
    registryVersionLabel: observatory.versionLabel,
    generatedAt: observatory.generatedAt,
    keyFindings: findings,
    sections,
    limitations,
    correctionLog: [],
  };
}

export type ResearchPublicationValidationIssue = { code: string; message: string };
export type ResearchPublicationValidationResult = {
  errors: ResearchPublicationValidationIssue[];
  warnings: ResearchPublicationValidationIssue[];
};

/**
 * The automated half of the research editorial review (§159/§211) — a
 * necessary but not sufficient gate before a Super Admin may approve
 * publication. Checks structural completeness (denominators, methodology
 * version, limitations) and scans for unsupported-authority phrasing (§5).
 */
export function validateResearchPublicationContent(
  content: ResearchPublicationContent,
): ResearchPublicationValidationResult {
  const errors: ResearchPublicationValidationIssue[] = [];
  const warnings: ResearchPublicationValidationIssue[] = [];

  if (!content.title.trim()) errors.push({ code: "MISSING_TITLE", message: "Title is empty." });
  if (!content.summary.trim())
    errors.push({ code: "MISSING_SUMMARY", message: "Summary is empty." });
  if (!content.methodologyVersion.trim())
    errors.push({ code: "MISSING_METHODOLOGY_VERSION", message: "Methodology version is empty." });
  if (!content.registryVersionId.trim())
    errors.push({ code: "MISSING_REGISTRY_VERSION", message: "Registry version is not pinned." });
  if (content.keyFindings.length === 0)
    errors.push({ code: "NO_FINDINGS", message: "Publication has no key findings." });
  if (content.limitations.length === 0)
    errors.push({ code: "NO_LIMITATIONS", message: "Publication has no limitations section." });

  for (const finding of content.keyFindings) {
    if (finding.denominator < 0 || finding.numerator < 0) {
      errors.push({
        code: "NEGATIVE_COUNT",
        message: `Finding "${finding.label}" has a negative numerator/denominator.`,
      });
    }
    if (finding.numerator > finding.denominator) {
      errors.push({
        code: "NUMERATOR_EXCEEDS_DENOMINATOR",
        message: `Finding "${finding.label}" has numerator (${finding.numerator}) exceeding denominator (${finding.denominator}).`,
      });
    }
    if (!finding.scope.trim()) {
      errors.push({ code: "MISSING_SCOPE", message: `Finding "${finding.label}" has no scope.` });
    }
    if (finding.denominator === 0) {
      warnings.push({
        code: "ZERO_DENOMINATOR",
        message: `Finding "${finding.label}" has a zero denominator — verify this renders as "insufficient basis", not 0%.`,
      });
    }
  }

  const textToScan = [
    content.title,
    content.summary,
    ...content.keyFindings.map((f) => f.label),
    ...content.sections.map((s) => s.body),
  ].join("\n");
  for (const pattern of BANNED_CLAIM_PATTERNS) {
    if (pattern.test(textToScan)) {
      errors.push({
        code: "UNSUPPORTED_CLAIM_LANGUAGE",
        message: `Publication text matches an unsupported-claim pattern: ${pattern}.`,
      });
    }
  }

  return { errors, warnings };
}
