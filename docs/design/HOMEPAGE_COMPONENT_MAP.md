# Homepage Component Map

**Level 1 document (Current authoritative).** Every component the homepage and `/sample-report`
use, established Phase 4, 2026-08-04.

| Component                  | File                                                           | Purpose                                   | Rendering                                                            | Data source                                                            | Tests                                                          | Accessibility notes                                       | Performance notes                                                      | Reuse                                                      |
| -------------------------- | -------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| `RiskSection`              | `apps/web/src/components/homepage/RiskSection.astro`           | Section 2, three risk cards               | Server-rendered, static                                              | Inline constant                                                        | `homepage-sections.test.ts`                                    | One H2, three H3s                                         | No JS shipped                                                          | Homepage only                                              |
| `SampleReportSection`      | `apps/web/src/components/homepage/SampleReportSection.astro`   | Section 3, compact report teaser          | Server-rendered wrapper; hydrates `ReportPreview` (`client:visible`) | `sample-report.fixture.ts`                                             | `homepage-sections.test.ts`, existing `ReportPreview` coverage | One H2; `ReportPreview` unchanged                         | Only the existing `ReportPreview` island loads, deferred until visible | Homepage only                                              |
| `CrawlerPurposeSection`    | `apps/web/src/components/homepage/CrawlerPurposeSection.astro` | Section 5, four purpose cards             | Server-rendered, static                                              | Inline constant (matches `docs/brand/PRODUCT_TERMINOLOGY_GLOSSARY.md`) | `homepage-sections.test.ts`                                    | One H2, four H3s                                          | No JS shipped                                                          | Homepage only                                              |
| `AgencySection`            | `apps/web/src/components/homepage/AgencySection.astro`         | Section 6, agency workflow                | Server-rendered, static                                              | Inline constant                                                        | `homepage-sections.test.ts`                                    | One H2, workflow list, two H3s                            | No JS shipped                                                          | Homepage only                                              |
| `PricingPreviewSection`    | `apps/web/src/components/homepage/PricingPreviewSection.astro` | Section 10, pricing preview               | Server-rendered, static                                              | `plans` prop (from `apps/web/src/lib/plans.ts`)                        | `homepage-sections.test.ts`, `plans.test.ts`                   | One H2, per-plan H3s                                      | No JS shipped                                                          | Homepage; could be reused by a future landing page         |
| `AuditReportView`          | `apps/web/src/components/AuditReportView.tsx`                  | Full report rendering                     | Hydrated (`client:load`)                                             | `report` prop                                                          | Existing (pre-Phase-4)                                         | Its own H1, semantic table, `StatusChip` tone+label pairs | Unchanged — same component real reports already use                    | `/audit/[auditId]` (real reports) and now `/sample-report` |
| `Banner` (`@crawlpact/ui`) | `packages/ui/src/components/Banner.tsx`                        | "Sample report" label on `/sample-report` | Server-rendered (no hydration needed for this static usage)          | prop children                                                          | Existing package tests                                         | `role="status"`, not a heading                            | No JS shipped in this usage                                            | Already used elsewhere in the design system                |
| `plans.ts`                 | `apps/web/src/lib/plans.ts`                                    | Single source for plan data               | N/A (data module)                                                    | Hand-authored constant, mirrors `pricing.astro`'s prior array exactly  | `plans.test.ts`                                                | N/A                                                       | N/A                                                                    | `pricing.astro`, `PricingPreviewSection.astro`             |
| `sample-report.fixture.ts` | `apps/web/src/lib/sample-report.fixture.ts`                    | Sample report data                        | N/A (data module)                                                    | Hand-authored, typed `AuditReportResponse`                             | `sample-report.fixture.test.ts`                                | N/A                                                       | N/A                                                                    | `sample-report.astro`, `SampleReportSection.astro`         |

## Removed

No component was deleted — `ReportPreview.tsx` is retained and reused (now inside
`SampleReportSection.astro` instead of directly inline in `index.astro`). The former inline
"Core features" 7-card grid and "Built for real workflows" 6-card grid in `index.astro` were
removed as standalone sections (their content is consolidated into `AgencySection` and the
evidence/methodology section) but were plain inline JSX, not extracted components, so there is no
corresponding component file to delete.

## Astro islands on the homepage (unchanged count from before Phase 4)

- `AuditForm` — `client:load` (hero) and `client:visible` (final CTA) — two instances, same as
  before.
- `ReportPreview` — `client:visible` — one instance, same as before, now inside
  `SampleReportSection.astro` rather than inline.
- `Accordion` (FAQ) — `client:visible` — unchanged.
- `AnalyticsBeacon` — `client:load` — unchanged.
- `MobileNav` — `client:idle`, in `SiteHeader.astro` — unchanged, not part of this phase.

No new client island was added to the homepage itself. `/sample-report` adds exactly one new
hydrated component (`AuditReportView`, `client:load`), scoped to that route only.
