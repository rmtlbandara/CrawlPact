import type { AuditReportResponse } from "@crawlpact/core";

/**
 * Static, fictional sample report fixture for `/sample-report` (Phase 4, Homepage Information
 * Architecture and Conversion Redesign). Purpose: let a visitor see the full report structure
 * before running their own audit or creating an account.
 *
 * FICTIONAL STATUS: every value below is invented for demonstration. `sample-domain.example` is
 * not a real, resolvable, or customer-owned domain — it is reserved under RFC 2606 conventions
 * (the `.example` TLD is set aside specifically for documentation). This fixture must never be
 * confused with a real scan: no customer data, no private domain, no real subscription, and no
 * production security event appear anywhere in it. See `docs/design/HOMEPAGE_CONTENT_MODEL.md`
 * for how this fixture is presented (a persistent "Sample report" banner, never as a live result).
 *
 * Update responsibility: Product owner, reviewed whenever `AuditReportResponse`'s schema
 * (`packages/core/src/api/contracts/audit.ts`) changes, so this fixture stays a valid instance of
 * the same real contract used for actual reports — not a hand-drifted lookalike.
 *
 * Relationship to the real report schema: this is a plain object literal typed as
 * `AuditReportResponse`, the exact same type `apps/web/src/lib/report-view-data.ts` produces for
 * a real, completed scan — `AuditReportView` (the same component that renders real reports)
 * consumes it directly, so the sample report can never silently drift from real report structure.
 *
 * No production persistence: this fixture is never written to D1, never has an `auditId` that
 * resolves through `/api/audit/:auditId`, and is rendered only by the static `/sample-report`
 * page — it has no server-side data dependency at all.
 */
export const SAMPLE_REPORT: AuditReportResponse = {
  auditId: "sample-fixture-not-a-real-audit",
  domain: "sample-domain.example",
  scanDate: "2026-08-01T09:00:00.000Z",
  status: "completed_with_warnings",
  preset: "Allow search, block training",
  score: {
    state: "scored",
    value: 68,
    label: "Needs attention",
    categoryBreakdown: [
      { label: "Resource availability", value: 90 },
      { label: "Syntax & evaluation", value: 85 },
      { label: "Objective alignment", value: 45 },
      { label: "Cross-signal consistency", value: 70 },
    ],
  },
  crawlerMatrix: [
    {
      crawlerId: "oai-searchbot",
      crawlerName: "OAI-SearchBot",
      operator: "OpenAI",
      purpose: "search",
      result: "allowed",
      matchedRule: "Allow: /",
      matchedLineNumber: 4,
      source: "robots.txt",
      lastVerified: "2026-07-20T00:00:00.000Z",
    },
    {
      crawlerId: "gptbot",
      crawlerName: "GPTBot",
      operator: "OpenAI",
      purpose: "training",
      result: "no_explicit_rule",
      matchedRule: null,
      matchedLineNumber: null,
      source: "robots.txt",
      lastVerified: "2026-07-20T00:00:00.000Z",
    },
    {
      crawlerId: "claudebot",
      crawlerName: "ClaudeBot",
      operator: "Anthropic",
      purpose: "training",
      result: "blocked",
      matchedRule: "Disallow: /",
      matchedLineNumber: 12,
      source: "robots.txt",
      lastVerified: "2026-07-18T00:00:00.000Z",
    },
    {
      crawlerId: "google-extended",
      crawlerName: "Google-Extended",
      operator: "Google",
      purpose: "training",
      result: "blocked",
      matchedRule: "Disallow: /",
      matchedLineNumber: 12,
      source: "robots.txt",
      lastVerified: "2026-07-15T00:00:00.000Z",
    },
    {
      crawlerId: "chatgpt-user",
      crawlerName: "ChatGPT-User",
      operator: "OpenAI",
      purpose: "user_triggered",
      result: "allowed",
      matchedRule: "Allow: /",
      matchedLineNumber: 4,
      source: "robots.txt",
      lastVerified: "2026-07-20T00:00:00.000Z",
    },
    {
      crawlerId: "perplexitybot",
      crawlerName: "PerplexityBot",
      operator: "Perplexity",
      purpose: "search",
      result: "mixed",
      matchedRule: "Disallow: /private/",
      matchedLineNumber: 8,
      source: "robots.txt",
      lastVerified: "2026-07-10T00:00:00.000Z",
    },
  ],
  findings: [
    {
      code: "sample-training-unspecified",
      severity: "medium",
      category: "objective_alignment",
      title: "GPTBot has no explicit rule",
      summary: "Selected objective is to block training crawlers, but GPTBot is unaddressed.",
      whatHappened:
        "robots.txt does not name GPTBot in any User-agent group, so no explicit rule currently applies to it.",
      whyItMatters:
        'The selected objective ("Allow search, block training") intends to restrict model-training crawlers, but an unaddressed crawler is not the same as an explicit block.',
      evidenceSummary: "robots.txt, fetched 2026-08-01 — no User-agent group names GPTBot.",
      recommendedAction: "Add an explicit Disallow rule naming GPTBot's user-agent token.",
      limitation:
        "CrawlPact cannot confirm whether GPTBot actually requests this website — only that no rule currently addresses it.",
      confidence: "high",
      sourceUrl: null,
      rulesetVersion: "2026.07.2",
    },
    {
      code: "sample-conflicting-search-rule",
      severity: "low",
      category: "cross_signal_consistency",
      title: "PerplexityBot is partially restricted",
      summary: "A path-scoped rule blocks PerplexityBot from part of the site.",
      whatHappened:
        "robots.txt disallows /private/ for PerplexityBot specifically, while allowing the rest of the site.",
      whyItMatters:
        "This may be intentional (protecting a private section) or an unintended narrower rule than other search crawlers receive.",
      evidenceSummary: "robots.txt, fetched 2026-08-01, line 8.",
      recommendedAction:
        "Confirm whether restricting PerplexityBot from /private/ specifically, rather than all crawlers, is intended.",
      limitation: null,
      confidence: "medium",
      sourceUrl: null,
      rulesetVersion: "2026.07.2",
    },
  ],
  findingsOmittedCount: 0,
  registryVersion: "2026.07.3",
  rulesetVersion: "2026.07.2",
  limitations: [
    "This is a sample report generated from a fixture, not a real scan of any website.",
    "Results describe declared public policy signals; they do not prove actual crawler behaviour or compliance.",
    "CrawlPact does not have server-log access and cannot confirm whether any crawler actually requested this site.",
    "Crawler classifications reflect the registry version shown above and may change as operators update their documentation.",
  ],
  llmsTxt: {
    checked: true,
    found: false,
    hasH1Heading: false,
    linkedResources: [],
    sizeBytes: 0,
    issues: [],
  },
  llmsFullTxt: {
    checked: true,
    found: false,
    hasH1Heading: false,
    linkedResources: [],
    sizeBytes: 0,
    issues: [],
  },
  rsl: {
    checked: true,
    discovered: false,
    permits: [],
    prohibits: [],
    paymentTerms: [],
    unsupportedElements: [],
    issues: [],
  },
  contentSignals: {
    checked: true,
    present: false,
    recognised: {},
    unknownFields: {},
    raw: null,
  },
  robotsMeta: {
    checked: true,
    metaRobots: null,
    canonicalUrl: null,
    policyReferenceLinks: [],
    xRobotsTag: [],
  },
};
