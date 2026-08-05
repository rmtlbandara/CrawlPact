import type { Conflict, ConflictCode } from "./conflicts";

export type FindingSeverity = "critical" | "high" | "medium" | "low" | "information";

export type Finding = {
  code: string;
  severity: FindingSeverity;
  category: string;
  title: string;
  summary: string;
  whatHappened: string;
  whyItMatters: string;
  evidenceSummary: string;
  recommendedAction: string;
  limitation: string | null;
  confidence: "high" | "medium" | "low";
  sourceUrl: string | null;
  rulesetVersion: string;
  affectedCrawlerId: string | null;
  fingerprint: string;
};

const SEVERITY_BY_CODE: Record<ConflictCode, FindingSeverity> = {
  SEARCH_VISIBILITY_CONFLICT: "critical",
  TRAINING_RESTRICTION_CONFLICT: "high",
  BROAD_WILDCARD_OVERRIDE: "medium",
  DEPRECATED_TOKEN_IN_USE: "medium",
  REPLACEMENT_TOKEN_MISSING: "medium",
  PAGE_DIRECTIVE_UNREACHABLE: "low",
  RSL_CONTENT_SIGNALS_DISAGREEMENT: "medium",
  HEADER_SITE_DISAGREEMENT: "low",
  DUPLICATE_GROUP_UNEXPECTED_MATCH: "medium",
  UNKNOWN_PURPOSE_REQUIRES_REVIEW: "information",
};

const TITLE_BY_CODE: Record<ConflictCode, string> = {
  SEARCH_VISIBILITY_CONFLICT: "A search crawler is blocked",
  TRAINING_RESTRICTION_CONFLICT: "A training crawler is not restricted",
  BROAD_WILDCARD_OVERRIDE: "A broad wildcard rule blocks unlisted crawlers",
  DEPRECATED_TOKEN_IN_USE: "A deprecated crawler token is referenced",
  REPLACEMENT_TOKEN_MISSING: "No rule exists for a crawler's replacement token",
  PAGE_DIRECTIVE_UNREACHABLE: "A page-level directive is unreachable for this crawler",
  RSL_CONTENT_SIGNALS_DISAGREEMENT: "RSL and Content Signals disagree",
  HEADER_SITE_DISAGREEMENT: "Header and site-level signals disagree",
  DUPLICATE_GROUP_UNEXPECTED_MATCH: "A crawler token appears in multiple groups",
  UNKNOWN_PURPOSE_REQUIRES_REVIEW: "A crawler's purpose needs verification",
};

const CATEGORY_BY_CODE: Record<ConflictCode, string> = {
  SEARCH_VISIBILITY_CONFLICT: "objective-alignment",
  TRAINING_RESTRICTION_CONFLICT: "objective-alignment",
  BROAD_WILDCARD_OVERRIDE: "robots-syntax",
  DEPRECATED_TOKEN_IN_USE: "registry-freshness",
  REPLACEMENT_TOKEN_MISSING: "registry-freshness",
  PAGE_DIRECTIVE_UNREACHABLE: "cross-signal",
  RSL_CONTENT_SIGNALS_DISAGREEMENT: "cross-signal",
  HEADER_SITE_DISAGREEMENT: "cross-signal",
  DUPLICATE_GROUP_UNEXPECTED_MATCH: "robots-syntax",
  UNKNOWN_PURPOSE_REQUIRES_REVIEW: "registry-freshness",
};

/** A short, stable, non-cryptographic hash for deduplicating findings across scans. */
function fingerprint(parts: string[]): string {
  const input = parts.join("|");
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Converts deterministic conflicts (SRS §20) into fully-structured findings
 * (SRS §22.1), following the "what happened / why it matters / evidence /
 * recommended action / limitation" pattern from SRS §10.51.
 */
export function buildFindings(conflicts: Conflict[], rulesetVersion: string): Finding[] {
  return conflicts.map((conflict) => ({
    code: conflict.code,
    severity: SEVERITY_BY_CODE[conflict.code],
    category: CATEGORY_BY_CODE[conflict.code],
    title: TITLE_BY_CODE[conflict.code],
    summary: conflict.evidence,
    whatHappened: conflict.evidence,
    whyItMatters: conflict.likelyBusinessEffect,
    evidenceSummary: conflict.evidence,
    recommendedAction: conflict.recommendedAction,
    limitation:
      conflict.confidence !== "high"
        ? "This finding's confidence is not high — verify before treating it as certain."
        : null,
    confidence: conflict.confidence,
    sourceUrl: null,
    rulesetVersion,
    affectedCrawlerId: conflict.affectedCrawlerId,
    fingerprint: fingerprint([conflict.code, conflict.affectedCrawlerId ?? "", conflict.evidence]),
  }));
}

/** Phase 11 (Database, Storage, Retention and Performance Hardening), §12.
 * A single misconfigured site can trigger one finding per crawler per
 * conflict code (e.g. every deprecated token referenced across 21 crawlers),
 * producing dozens of near-duplicate rows from one scan — uncapped, this
 * drives both D1 write volume and the report page's own render cost with no
 * proportional increase in what the customer actually learns. Real
 * production data (2026-08-05) never exceeded 10 findings in a single scan;
 * this cap exists for the adversarial/pathological case a public, anonymous,
 * arbitrary-target tool must expect by design, not because real usage is
 * anywhere close to it. */
export const MAX_PERSISTED_FINDINGS = 25;

const SEVERITY_RANK: Record<FindingSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  information: 4,
};

export type FindingSelection = {
  /** Findings to actually persist, in the order they should be written/shown. */
  kept: Finding[];
  /** How many were left out — 0 means nothing was capped. */
  omittedCount: number;
};

/**
 * Selects which findings to persist when the list exceeds `MAX_PERSISTED_FINDINGS`.
 * Never silently discards without disclosure — callers must persist
 * `omittedCount` and never claim "all findings" once it's non-zero (see
 * `scans.findings_capped`/`findings_omitted_count`, migration 0024).
 *
 * Deterministic ordering, in priority order:
 * 1. Highest severity first (critical > high > medium > low > information).
 * 2. Diversity across finding codes: every distinct code present gets its
 *    highest-severity instance before any code gets a second instance, so a
 *    single high-volume code (e.g. one deprecated-token finding per crawler)
 *    cannot crowd out every other kind of issue on the report.
 * 3. Stable by original array position within a (severity, code) group, so
 *    the same input always produces the same output.
 *
 * This never reorders or changes what scoring/recommendations saw — both
 * are computed upstream, from the full uncapped list, before this function
 * ever runs; capping only affects what gets persisted as evidence rows.
 */
export function selectFindingsForPersistence(
  findings: Finding[],
  cap: number = MAX_PERSISTED_FINDINGS,
): FindingSelection {
  if (findings.length <= cap) {
    return { kept: findings, omittedCount: 0 };
  }

  const sorted = findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => {
      const severityDelta = SEVERITY_RANK[a.finding.severity] - SEVERITY_RANK[b.finding.severity];
      if (severityDelta !== 0) return severityDelta;
      if (a.finding.code !== b.finding.code) return a.finding.code < b.finding.code ? -1 : 1;
      return a.index - b.index;
    })
    .map((entry) => entry.finding);

  const byCode = new Map<string, Finding[]>();
  for (const finding of sorted) {
    const group = byCode.get(finding.code);
    if (group) group.push(finding);
    else byCode.set(finding.code, [finding]);
  }
  const codeGroups = [...byCode.values()];

  const kept: Finding[] = [];
  for (let round = 0; kept.length < cap; round++) {
    let addedThisRound = false;
    for (const group of codeGroups) {
      if (kept.length >= cap) break;
      if (round < group.length) {
        kept.push(group[round]!);
        addedThisRound = true;
      }
    }
    if (!addedThisRound) break;
  }

  return { kept, omittedCount: findings.length - kept.length };
}
