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
