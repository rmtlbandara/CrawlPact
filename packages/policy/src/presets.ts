import type { CrawlerPurpose } from "@crawlpact/registry";

/**
 * The four policy presets (SRS §18). A preset never modifies a scanned
 * website (FR-POL-003) — it only changes how CrawlPact *interprets*
 * declared results into alignment, severity, and recommendations.
 */
export const POLICY_PRESETS = [
  "maximum_ai_visibility",
  "allow_search_block_training",
  "publisher_protection",
  "block_known_ai_crawlers",
] as const;
export type PolicyPreset = (typeof POLICY_PRESETS)[number];

export const POLICY_PRESET_LABELS: Record<PolicyPreset, string> = {
  maximum_ai_visibility: "Maximum AI Visibility",
  allow_search_block_training: "Allow Search, Block Training",
  publisher_protection: "Publisher Protection",
  block_known_ai_crawlers: "Block Known AI Crawlers",
};

export const POLICY_PRESET_DESCRIPTIONS: Record<PolicyPreset, string> = {
  maximum_ai_visibility:
    "For websites prioritising AI search and user-triggered discovery across every crawler purpose.",
  allow_search_block_training:
    "For websites that want AI search visibility while restricting documented training crawlers.",
  publisher_protection:
    "For publishers requiring an explicit decision on every crawler, training restricted, and licensing signals checked.",
  block_known_ai_crawlers:
    "For restrictive policies, with a clear warning about the likely AI-search-visibility consequence.",
};

/** SRS FR-POL-001: the seven possible declared-access results. */
export const CRAWLER_RESULT_VALUES = [
  "allowed",
  "blocked",
  "no_explicit_rule",
  "mixed",
  "unknown",
  "resource_unavailable",
  "not_evaluated",
] as const;
export type CrawlerResultValue = (typeof CRAWLER_RESULT_VALUES)[number];

export type PresetExpectation =
  "expect_allowed" | "expect_blocked" | "expect_explicit_decision" | "no_expectation";

/**
 * The purpose x preset expectation matrix. This is the one place preset
 * semantics are defined — findings, scoring, and recommendations all read
 * this table rather than re-encoding preset logic themselves.
 */
const EXPECTATION_MATRIX: Record<PolicyPreset, Record<CrawlerPurpose, PresetExpectation>> = {
  maximum_ai_visibility: {
    search: "expect_allowed",
    training: "expect_allowed",
    user_triggered: "expect_allowed",
    agent: "expect_allowed",
    advertising_validation: "no_expectation",
    research: "expect_allowed",
    mixed: "expect_allowed",
    unknown: "no_expectation",
  },
  allow_search_block_training: {
    search: "expect_allowed",
    training: "expect_blocked",
    user_triggered: "expect_allowed",
    agent: "no_expectation",
    advertising_validation: "no_expectation",
    research: "expect_blocked",
    mixed: "expect_explicit_decision",
    unknown: "no_expectation",
  },
  publisher_protection: {
    search: "expect_explicit_decision",
    training: "expect_blocked",
    user_triggered: "expect_explicit_decision",
    agent: "expect_explicit_decision",
    advertising_validation: "expect_explicit_decision",
    research: "expect_blocked",
    mixed: "expect_explicit_decision",
    unknown: "expect_explicit_decision",
  },
  block_known_ai_crawlers: {
    search: "expect_blocked",
    training: "expect_blocked",
    user_triggered: "expect_blocked",
    agent: "expect_blocked",
    advertising_validation: "expect_blocked",
    research: "expect_blocked",
    mixed: "expect_blocked",
    unknown: "expect_blocked",
  },
};

export function expectationFor(preset: PolicyPreset, purpose: CrawlerPurpose): PresetExpectation {
  return EXPECTATION_MATRIX[preset][purpose];
}

export type AlignmentResult = "aligned" | "misaligned" | "review_needed" | "not_applicable";

/**
 * Compares a crawler's declared result against what the selected preset
 * expects for that crawler's purpose (SRS §18 FR-POL-002).
 */
export function evaluateAlignment(
  preset: PolicyPreset,
  purpose: CrawlerPurpose,
  result: CrawlerResultValue,
): AlignmentResult {
  const expectation = expectationFor(preset, purpose);

  if (expectation === "no_expectation") return "not_applicable";

  if (expectation === "expect_explicit_decision") {
    return result === "allowed" || result === "blocked" ? "aligned" : "review_needed";
  }

  const wantsAllowed = expectation === "expect_allowed";
  if (result === "allowed") return wantsAllowed ? "aligned" : "misaligned";
  if (result === "blocked") return wantsAllowed ? "misaligned" : "aligned";
  return "review_needed";
}
