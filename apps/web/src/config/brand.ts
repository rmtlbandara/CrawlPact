/**
 * Central, typed source for CrawlPact's canonical brand and messaging language — established
 * Phase 2 (Brand Positioning and Messaging System), 2026-08-03. Full rationale, audience
 * hierarchy, and objection-handling live in `docs/brand/BRAND_POSITIONING_AND_MESSAGING_SYSTEM.md`;
 * this module exists so metadata, structured data, layouts, and tests can reuse the same
 * canonical strings instead of re-typing them independently on every page (the exact drift
 * Phase 2 was created to close).
 *
 * Deliberately does NOT duplicate:
 * - Legal/trust facts (entity name, jurisdiction, contacts, provider names) — see
 *   `apps/web/src/lib/trust-config.ts`.
 * - Plan prices/limits — see `packages/database` (the plans table is the source of truth) and
 *   `apps/web/src/pages/pricing.astro`.
 * - Current platform/capability status — see `docs/status/CURRENT_STATE.md`.
 *
 * This file centralises canonical BRAND LANGUAGE only, not every sentence in the application —
 * see `docs/brand/BRAND_POSITIONING_AND_MESSAGING_SYSTEM.md`'s "Central Messaging Configuration"
 * section for why the scope is deliberately narrow.
 */

export const BRAND = {
  productName: "CrawlPact",

  tagline: "AI crawler policy, verified.",

  brandPromise: "Know what your website tells AI crawlers — and when it changes.",

  publicCategory: "AI crawler policy audit and monitoring",
  strategicCategory: "AI crawler policy governance",

  descriptions: {
    oneSentence:
      "CrawlPact independently audits and monitors the public policy signals websites publish to AI crawlers.",
    short:
      "CrawlPact audits robots.txt and related public signals, separates search from training and agent crawlers, explains conflicts, and monitors policy changes across any hosting provider.",
    medium:
      "CrawlPact is an independent AI crawler policy audit and monitoring platform. It shows what a website currently tells search, training, retrieval, and agent crawlers, preserves evidence, explains conflicting signals, and detects both website-policy and verified crawler-registry changes.",
    long: "CrawlPact is the independent AI crawler policy audit and monitoring platform for agencies and multi-site teams. It shows what each website tells search, training, retrieval, and agent crawlers, explains policy conflicts, and alerts teams when either the website configuration or verified crawler registry changes — across any hosting provider or CDN.",
    agency:
      "CrawlPact helps agencies audit, explain, and monitor AI crawler policy across client portfolios without installing software or moving websites behind a particular CDN.",
    technical:
      "CrawlPact fetches and evaluates publicly accessible crawler-policy signals against a versioned, source-backed crawler registry and produces deterministic findings, evidence, recommendations, and change records.",
  },

  /** GitHub repository description — keep within GitHub's ~350-character limit. */
  githubDescription:
    "Independent AI crawler policy auditing and monitoring across websites, hosting providers, and CDNs.",

  /** Social/Open Graph description for share previews. */
  socialDescription:
    "Audit what websites tell AI search, training, retrieval, and agent crawlers — and monitor when the policy or verified crawler registry changes.",

  /** Default `<title>` suffix for pages that don't set a fully custom title. */
  defaultTitleSuffix: "CrawlPact",

  primaryAudience: "agencies and multi-site teams",

  /** Core differentiator statement — used in comparison/objection contexts. */
  differentiator:
    "Independent, vendor-neutral crawler-policy evidence across any hosting provider or CDN.",

  /**
   * The approved boundary statement — use verbatim or lightly adapted, never contradicted.
   * See docs/brand/CLAIMS_AND_MESSAGING_GUIDE.md.
   */
  approvedBoundaryStatement:
    "CrawlPact audits the public policy signals a website publishes. It does not control external crawlers or guarantee that they will comply.",

  /**
   * Standard report disclaimer — adapt wording to fit the interface, but preserve meaning.
   * See docs/brand/CLAIMS_AND_MESSAGING_GUIDE.md.
   */
  standardReportDisclaimer:
    "CrawlPact evaluates publicly accessible policy signals against its current verified crawler registry. Results describe the website's published policy and do not guarantee external crawler behaviour or legal compliance.",

  /** Standard registry disclaimer for crawler-directory and registry-adjacent surfaces. */
  standardRegistryDisclaimer:
    "Crawler classifications are sourced from each operator's own official documentation and carry a verification date. An unspecified purpose is recorded honestly rather than guessed.",

  /**
   * Canonical CTA labels — see docs/brand/BRAND_POSITIONING_AND_MESSAGING_SYSTEM.md's CTA
   * hierarchy. `primaryAcquisition` matches the wording already consistent across SiteHeader,
   * crawler detail, and guide detail pages (`AuditForm.tsx`'s button was the one outlier, since
   * corrected to match — see docs/brand/MESSAGING_SURFACE_INVENTORY.md A5).
   */
  cta: {
    primaryAcquisition: "Audit a domain",
    accountConversion: "Save and monitor this domain",
    monitoring: "Enable monitoring",
  },
} as const;

export type Brand = typeof BRAND;
