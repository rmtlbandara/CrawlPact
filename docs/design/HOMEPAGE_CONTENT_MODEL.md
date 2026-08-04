# Homepage Content Model

**Level 1 document (Current authoritative).** Every piece of homepage copy, its data source, and
who owns it. Established Phase 4, 2026-08-04.

## Headline and supporting copy

| Field                | Value                                                                                                                                                                                            | Source                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| H1                   | "Audit and monitor your website's AI crawler policy."                                                                                                                                            | Unchanged from before Phase 4 — SRS §2.2-aligned, Phase-2-validated (see `docs/design/PHASE_04_HOMEPAGE_BASELINE.md` "Implementation decisions") |
| Hero supporting copy | "CrawlPact independently audits robots.txt and related public signals, separates search from training and agent crawlers, explains conflicts, and monitors changes across any hosting provider." | `apps/web/src/pages/index.astro` (matches `BRAND.descriptions.short` in meaning)                                                                 |
| Hero microcopy       | "No installation, server-log access, or AI API required."                                                                                                                                        | `index.astro`                                                                                                                                    |

## CTA labels

| CTA                       | Label                                                    | Destination                  | Source                                                                                                                     |
| ------------------------- | -------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Primary acquisition       | "Audit a domain"                                         | hero form submit             | `BRAND.cta.primaryAcquisition` (`apps/web/src/config/brand.ts`) — deliberately not "Audit a domain free," see baseline doc |
| Secondary (sample report) | "View a sample report" / "View the full sample report →" | `/sample-report`             | new this phase                                                                                                             |
| Agency                    | "Review Agency pricing"                                  | `/pricing#agency`            | new this phase                                                                                                             |
| Pricing preview           | per-plan `cta` field (e.g. "Choose Pro")                 | `/pricing#<planId>`          | `apps/web/src/lib/plans.ts`                                                                                                |
| Final CTA                 | "Audit a domain" (form) / "View a sample report" (link)  | hero form / `/sample-report` | reused                                                                                                                     |

## Section headings

See `docs/design/HOMEPAGE_INFORMATION_ARCHITECTURE.md`'s section table for the full list and
rationale; headings themselves are inline in `apps/web/src/pages/index.astro` and the `homepage/`
section components — not centralised into a config, since they are prose, not reusable facts (per
`brand.ts`'s own documented scope: "centralises canonical BRAND LANGUAGE only, not every sentence
in the application").

## FAQ questions

10 questions total, revised to match Phase 4's required minimum question set (§18) verbatim in
substance. Five of the original ten were retained unchanged in effect ("Does CrawlPact block AI
crawlers?", "Does CrawlPact guarantee crawler compliance?" — reworded around "robots.txt"
specifically per Phase 4's exact wording, "Is CrawlPact legal advice or compliance certification?",
and the monitoring/notifications answer). Five were replaced with Phase 4's explicitly required
questions that the previous set didn't cover in this form: the AI-search-vs-training distinction,
"What does 'unspecified' mean?", server-log access, hosting-provider independence, and "Is
llms.txt required?" — displacing "Do I need to install anything?", "Does CrawlPact use AI?", "What
websites can CrawlPact audit?", "How are crawler purposes verified?", and "What happens when a
crawler changes?" (this last topic is still covered, in more depth, by Section 9's
website-policy-vs-registry-driven-change explanation). Full current list lives in
`apps/web/src/pages/index.astro`'s `faqItems` array, mirrored exactly in `FAQPage` JSON-LD (SRS
§9.24 — enforced by inspection, not automated diffing, same as before this phase).

## Standard limitations

- Final CTA: "Results describe published policy signals and do not guarantee crawler behaviour."
- `/sample-report` banner: "Sample report — demonstrates report structure using a fictional
  domain. This is not a live audit of your website."
- Approved boundary statement (Section 7): `BRAND.approvedBoundaryStatement` — "CrawlPact audits
  the public policy signals a website publishes. It does not control external crawlers or
  guarantee that they will comply."

## Data-driven fields

| Field                                   | Source                                      | Notes                                                                                                      |
| --------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Crawler directory preview (4 entries)   | `getCollection("crawlers")`, first 4        | Unchanged from before Phase 4                                                                              |
| Sample report fixture                   | `apps/web/src/lib/sample-report.fixture.ts` | Typed as `AuditReportResponse` — same contract real reports use                                            |
| Sample report finding shown on homepage | `SAMPLE_REPORT.findings[0]`                 | Drawn from the same fixture the full `/sample-report` page renders, so the two surfaces cannot drift apart |

## Plan fields (pricing preview)

Reads `name`, `audience`, `price`, `domains`, `monitoring`, `cta`, `recommended`, `id` directly
from `apps/web/src/lib/plans.ts`'s `PLANS` array — the same array `/pricing` imports. No field is
duplicated or re-typed on the homepage.

## Proof fields

Per `docs/brand/CLAIMS_AND_MESSAGING_GUIDE.md` and Phase 4's "real metrics only" rule: **no
customer-count, rating, testimonial, logo, or usage metric is shown anywhere on the homepage.**
The "no-proof fallback" list (vendor-neutral, no installation, source-backed registry, public
methodology, versioned evidence, deterministic findings, transparent limitations) is used instead,
consistent with what was already true before this phase (Phase 2's audit found zero fabricated
proof anywhere in the product).

## Links

See `docs/design/HOMEPAGE_INFORMATION_ARCHITECTURE.md`'s section table. Required destinations
(pricing, sample report, crawler directory, methodology, about, status, security, contact) are all
reachable from the homepage body (Section 7's link row covers methodology/crawler
directory/status/security/about/corrections; footer covers all trust pages including contact; see
`apps/web/src/components/SiteFooter.astro`, unchanged this phase).

## Sample-report indexability decision

**Indexable.** `/sample-report` provides substantive educational value (a full, real report
structure — findings, evidence, recommendations, limitations) rather than being a thin conversion
fixture, so it is not `noindex`. Documented here per Phase 4's explicit requirement to record this
decision deliberately rather than default it either way.

## Ownership

Product owner owns homepage copy and section order; Engineering owner owns component
implementation and the `plans.ts`/`sample-report.fixture.ts` data sources. Review trigger: any
change to `BRAND`, `TRUST_CONFIG`, or the `PLANS` array that this content depends on.
