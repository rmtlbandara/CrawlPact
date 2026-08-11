/**
 * Phase 16 Policy Observatory research-methodology constants — see
 * docs/research/RESEARCH_METHODOLOGY.md and
 * docs/research/RESEARCH_CLAIM_CLASSIFICATION.md. A material methodological
 * change must bump this version, never overwrite what an already-published
 * publication says it used (§21).
 */
export const POLICY_OBSERVATORY_METHODOLOGY_VERSION = "policy-observatory-methodology-v1";

/** Minimum cohort size before a percentage is publishable at all — below
 * this, render "Insufficient sample" instead (§65). Only relevant once a
 * Layer B (website-policy) study exists; Layer A (registry) counts are
 * exhaustive population counts, not samples, so this threshold does not
 * apply to Registry Observatory findings. */
export const SMALL_CELL_THRESHOLD = 20;

/** Minimum number of comparable published releases before release-history
 * differences are described as a "trend" rather than a single
 * change-since-previous-run observation (§92). */
export const TREND_MIN_COMPARABLE_RUNS = 3;

/**
 * Section 5 / 102 — phrases that claim more than a bounded, denominator-
 * carrying evidence set can support. Used by `validateResearchPublicationContent`
 * and `pnpm research:validate` to catch an unsupported claim before
 * publication, not after.
 */
export const BANNED_CLAIM_PATTERNS: RegExp[] = [
  /\bdefinitive\b/i,
  /\bworld'?s most\b/i,
  /\bthe web is blocking\b/i,
  /\bmost websites\b/i,
  /%\s*of the internet\b/i,
  /\bindustry standard\b/i,
  /\bcomprehensive global study\b/i,
  /\bpeer[- ]reviewed\b/i,
  /\bacademic study\b/i,
  /\bscientific consensus\b/i,
  /\bshocking\b/i,
  /\btaking over the web\b/i,
];
