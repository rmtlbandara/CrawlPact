import { z } from "zod";

/**
 * Typed contract for POST /api/audit — SRS §14 (Public Audit Requirements),
 * §13 (Domain Input and Normalisation). This is the only contract in Part 1
 * that is actually wired to a live endpoint; see
 * apps/web/src/pages/api/audit/index.ts. Until Part 2 ships the scanner,
 * the handler returns AUDIT_ENGINE_DISABLED for every request rather than a
 * fabricated result (see docs/status/KNOWN_RISKS.md).
 */
export const createAuditRequestSchema = z.object({
  target: z
    .string()
    .trim()
    .min(1, "Enter a domain, such as example.com")
    .max(253, "This does not look like a valid domain or URL."),
  /**
   * Which `AuditForm` instance submitted this request (its `idPrefix`, e.g.
   * "hero", "final-cta", "audit-page", or a free-tool page) — recorded as
   * an analytics property so "Hero audit started" and "Final CTA audit
   * started" (SRS §9.20) can be distinguished from the same event stream.
   * Never validated against a fixed enum: an unrecognised or missing value
   * must never block a real audit, since this is purely observational.
   */
  source: z.string().min(1).max(64).optional(),
});
export type CreateAuditRequest = z.infer<typeof createAuditRequestSchema>;

export const AUDIT_STATUSES = [
  "queued",
  "running",
  "completed",
  "completed_with_warnings",
  "incomplete",
  "target_unavailable",
  "blocked_for_safety",
  "rate_limited",
  "internal_failure",
  "engine_disabled",
] as const;
export type AuditStatus = (typeof AUDIT_STATUSES)[number];

export const AUDIT_STAGES = [
  "validating_target",
  "checking_reachability",
  "retrieving_policy_resources",
  "parsing_directives",
  "evaluating_crawlers",
  "checking_additional_signals",
  "generating_findings",
  "preparing_report",
] as const;
export type AuditStage = (typeof AUDIT_STAGES)[number];

export const createAuditResponseSchema = z.object({
  auditId: z.string(),
  status: z.enum(AUDIT_STATUSES),
  originalInput: z.string(),
  normalizedOrigin: z.string().nullable(),
});
export type CreateAuditResponse = z.infer<typeof createAuditResponseSchema>;

/** GET /api/audit/:auditId — audit progress/state (SRS FR-AUD-002). */
export const auditStateResponseSchema = z.object({
  auditId: z.string(),
  status: z.enum(AUDIT_STATUSES),
  currentStage: z.enum(AUDIT_STAGES).nullable(),
  completedStages: z.array(z.enum(AUDIT_STAGES)),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  message: z.string().nullable(),
});
export type AuditStateResponse = z.infer<typeof auditStateResponseSchema>;

/**
 * GET /api/audit/:auditId/report — full report contract (SRS §23). The
 * shape is intentionally defined now so the landing-page report preview and
 * the future real report renderer share one type, even though Part 1 has no
 * populated data to return through this contract.
 */
export const crawlerResultValueSchema = z.enum([
  "allowed",
  "blocked",
  "no_explicit_rule",
  "mixed",
  "unknown",
  "resource_unavailable",
  "not_evaluated",
]);

export const crawlerPurposeSchema = z.enum([
  "search",
  "training",
  "user_triggered",
  "agent",
  "advertising_validation",
  "research",
  "mixed",
  "unknown",
]);

export const findingSeveritySchema = z.enum(["critical", "high", "medium", "low", "information"]);

export const findingSchema = z.object({
  code: z.string(),
  severity: findingSeveritySchema,
  category: z.string(),
  title: z.string(),
  summary: z.string(),
  whatHappened: z.string(),
  whyItMatters: z.string(),
  evidenceSummary: z.string(),
  recommendedAction: z.string(),
  limitation: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  sourceUrl: z.string().url().nullable(),
  rulesetVersion: z.string(),
});
export type Finding = z.infer<typeof findingSchema>;

export const crawlerMatrixRowSchema = z.object({
  crawlerId: z.string(),
  crawlerName: z.string(),
  operator: z.string(),
  purpose: crawlerPurposeSchema,
  result: crawlerResultValueSchema,
  matchedRule: z.string().nullable(),
  matchedLineNumber: z.number().int().positive().nullable(),
  source: z.string(),
  lastVerified: z.string().datetime().nullable(),
});
export type CrawlerMatrixRow = z.infer<typeof crawlerMatrixRowSchema>;

export const scoreCategoryBreakdownEntrySchema = z.object({
  label: z.string(),
  value: z.number().min(0).max(100),
});
export type ScoreCategoryBreakdownEntry = z.infer<typeof scoreCategoryBreakdownEntrySchema>;

export const policyHealthScoreSchema = z.union([
  z.object({
    state: z.literal("scored"),
    value: z.number().min(0).max(100),
    label: z.string(),
    categoryBreakdown: z.array(scoreCategoryBreakdownEntrySchema),
  }),
  z.object({ state: z.literal("incomplete") }),
]);

/**
 * Structured per-signal results (SRS §19, §30 free tools). `checked` is
 * true only when CrawlPact actually fetched and read the resource this
 * scan — distinct from `found`/`discovered`/`present`, which describe what
 * was in it. A tool page must never claim a result for a signal it never
 * checked.
 */
export const llmsTxtSignalSchema = z.object({
  checked: z.boolean(),
  found: z.boolean(),
  hasH1Heading: z.boolean(),
  linkedResources: z.array(z.string()),
  sizeBytes: z.number().int().min(0),
  issues: z.array(z.string()),
});
export type LlmsTxtSignal = z.infer<typeof llmsTxtSignalSchema>;

export const rslSignalSchema = z.object({
  checked: z.boolean(),
  discovered: z.boolean(),
  permits: z.array(z.string()),
  prohibits: z.array(z.string()),
  paymentTerms: z.array(z.string()),
  unsupportedElements: z.array(z.string()),
  issues: z.array(z.string()),
});
export type RslSignal = z.infer<typeof rslSignalSchema>;

export const contentSignalValueSchema = z.enum(["yes", "no", "unknown"]);

export const contentSignalsSignalSchema = z.object({
  checked: z.boolean(),
  present: z.boolean(),
  recognised: z.record(z.string(), contentSignalValueSchema),
  unknownFields: z.record(z.string(), z.string()),
  raw: z.string().nullable(),
});
export type ContentSignalsSignal = z.infer<typeof contentSignalsSignalSchema>;

export const robotsMetaSignalSchema = z.object({
  checked: z.boolean(),
  metaRobots: z.string().nullable(),
  canonicalUrl: z.string().nullable(),
  policyReferenceLinks: z.array(z.string()),
  xRobotsTag: z.array(z.string()),
});
export type RobotsMetaSignal = z.infer<typeof robotsMetaSignalSchema>;

export const auditReportResponseSchema = z.object({
  auditId: z.string(),
  domain: z.string(),
  scanDate: z.string().datetime(),
  status: z.enum(AUDIT_STATUSES),
  preset: z.string().nullable(),
  score: policyHealthScoreSchema,
  crawlerMatrix: z.array(crawlerMatrixRowSchema),
  findings: z.array(findingSchema),
  registryVersion: z.string().nullable(),
  rulesetVersion: z.string().nullable(),
  limitations: z.array(z.string()),
  llmsTxt: llmsTxtSignalSchema,
  llmsFullTxt: llmsTxtSignalSchema,
  rsl: rslSignalSchema,
  contentSignals: contentSignalsSignalSchema,
  robotsMeta: robotsMetaSignalSchema,
});
export type AuditReportResponse = z.infer<typeof auditReportResponseSchema>;
