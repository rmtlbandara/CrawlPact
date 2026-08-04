# Homepage Information Architecture

**Level 1 document (Current authoritative).** The approved homepage section order, established
Phase 4 (Homepage Information Architecture and Conversion Redesign), 2026-08-04. Supersedes the
implicit 14-section order documented as historical in `docs/design/PHASE_04_HOMEPAGE_BASELINE.md`.

## Audience journeys

| Audience                      | What they need to understand                                                | Homepage goal                                                   |
| ----------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Individual website owner      | The problem, how to run a free audit, how to read the result                | Start a free audit                                              |
| Agency or consultant          | Multi-domain relevance, client-reporting value, policy drift                | View a sample report; start a free audit; review Agency pricing |
| Publisher or content business | Search vs. training are different decisions; conflicts; monitoring value    | Audit current policy                                            |
| SaaS or documentation team    | Documentation discoverability, deployment-driven drift, historical evidence | Establish a baseline audit                                      |

## Section order and rationale

| #   | Section                                              | Primary message                                         | CTA                                                         | Supporting evidence                                             | Dependencies                                 |
| --- | ---------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------- |
| 1   | Hero                                                 | What CrawlPact does, for whom, first action             | Audit a domain (primary) / View a sample report (secondary) | Trust-strip claims (vendor-neutral, evidence-based, etc.)       | `AuditForm`, `WebsiteAuditMark`              |
| 2   | Three crawler-policy risks (`RiskSection`)           | Why crawler-policy mistakes matter, concretely          | none (informational)                                        | Three named risk scenarios                                      | none                                         |
| 3   | Sample report preview (`SampleReportSection`)        | What the output looks like, before auditing             | View the full sample report                                 | `ReportPreview` + one real finding from the sample fixture      | `sample-report.fixture.ts`                   |
| 4   | How CrawlPact works                                  | The 4-step process                                      | Methodology / crawler directory links                       | none                                                            | none                                         |
| 5   | Crawler purposes explained (`CrawlerPurposeSection`) | Search/training/retrieval/agent are different decisions | Crawler directory link                                      | Registry glossary terms                                         | `docs/brand/PRODUCT_TERMINOLOGY_GLOSSARY.md` |
| —   | Crawler directory preview                            | Concrete examples of the registry                       | View all crawlers                                           | 4 live registry entries                                         | `crawlers` content collection                |
| 6   | Agency and multi-domain workflow (`AgencySection`)   | Primary commercial audience is visible; real workflow   | Review Agency pricing / View a sample report                | 6-step workflow, 2 verified-capability cards                    | none                                         |
| 7   | Independent evidence and methodology                 | Vendor neutrality, evidence preservation, boundary      | 6 required trust links                                      | Approved boundary statement (`BRAND.approvedBoundaryStatement`) | `apps/web/src/config/brand.ts`               |
| 8   | Supported signals                                    | What's checked, primary vs. optional                    | none                                                        | Signal list + optional-signal disclaimer                        | none                                         |
| 9   | Monitoring and change detection                      | Two change sources (website vs. registry)               | Pricing link                                                | none                                                            | none                                         |
| 10  | Pricing preview (`PricingPreviewSection`)            | Plans exist, without altering pricing                   | Per-plan CTA to `/pricing#<planId>`                         | Same `PLANS` array as `/pricing`                                | `apps/web/src/lib/plans.ts`                  |
| 11  | FAQ                                                  | Objection handling, honest disclaimers                  | none                                                        | 10-item accordion, mirrored in `FAQPage` JSON-LD                | none                                         |
| 12  | Final audit CTA                                      | Low-friction final action                               | Audit a domain / View a sample report                       | Standard limitation line                                        | `AuditForm`                                  |

## Mobile behaviour

- Hero: `WebsiteAuditMark` artwork is `hidden xl:block` — hero meaning is carried entirely by the
  H1, supporting copy, and form on mobile, per Phase 4's requirement that the hero work without
  desktop artwork.
- All new sections use the same responsive grid classes already used elsewhere on the homepage
  (`grid gap-* sm:grid-cols-* lg:grid-cols-*`), so they collapse to a single column below `sm:`
  (640px in this project's remapped breakpoint scale — see `SiteHeader.astro`'s own comment).
- No new sticky or fixed elements were introduced.

## Accessibility considerations

- Exactly one `<h1>` (unchanged, in the hero).
- Every new section uses one `<h2>`, in document order, with no skipped levels.
- The `/sample-report` page's only heading-level element is `AuditReportView`'s own `<h1>` — the
  "Sample report" label is a `Banner` (`role="status"`), not a heading, to avoid a second H1.
- No color-only status indication was introduced (`StatusChip`, reused throughout, always pairs a
  tone with a text label).

## SEO role

- Homepage keeps its existing title/description (Phase 2-approved, `BRAND.descriptions.short`).
- `/sample-report` is a new indexable route (see `docs/design/HOMEPAGE_CONTENT_MODEL.md` for the
  indexability decision and rationale) with its own unique title/description/canonical.
- No section duplicates another route's full content — every section that overlaps with a
  dedicated page (pricing, methodology, crawler directory) is a deliberately shorter preview that
  links out, per Phase 4's "do not duplicate the full pricing page, methodology page, crawler
  directory, or report content" requirement.
