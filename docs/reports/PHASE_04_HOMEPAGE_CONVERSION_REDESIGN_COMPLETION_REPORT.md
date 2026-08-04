# Phase 4 — Homepage Information Architecture and Conversion Redesign — Completion Report

Branch `phase-04-homepage-conversion-redesign`, based on `main` at `abab3d4` (Phases 0-3 merged).
Established 2026-08-03/04.

## Executive summary

Before this phase, the homepage (`apps/web/src/pages/index.astro`) was a single 14-section file
with no dedicated risk-explanation section, no standalone sample-report route (only a small inline
`ReportPreview`), no dedicated agency/multi-domain section (agencies were one of six equally
weighted audience cards), a shallow six-pill crawler-purpose list, and a hand-typed pricing array
duplicating `pricing.astro`'s own `plans` array. Phase 4 rebuilt the homepage to a 12-section
information architecture, added a new indexable `/sample-report` route that reuses the same
`AuditReportView` component (and `AuditReportResponse` contract) real reports use — driven by a
new typed, schema-validated fixture, not a second rendering implementation — added a dedicated
agency/multi-domain workflow section, a proper four-category crawler-purpose explainer, and
consolidated the duplicated pricing array into one shared `apps/web/src/lib/plans.ts` module
consumed by both the homepage and `/pricing`. No backend audit/scanner/pricing/registry/billing
logic was touched. No fabricated proof, metric, testimonial, or logo was added anywhere — the
homepage still shows zero customer-count/rating/usage claims, consistent with Phase 2's own
research finding that the product was already free of fabricated proof.

A pre-existing WCAG violation was found and fixed as a direct result of this phase's own testing:
`AuditReportView`'s crawler-access-matrix table wrapper (a horizontally scrollable `<div>`) had no
keyboard access path under WebKit's `scrollable-region-focusable` rule. This had never previously
been caught because no static, testable page had ever rendered a full report table before
`/sample-report` existed. Fixed by adding `role="region"`, an `aria-label`, and `tabIndex={0}` to
the wrapper, following the exact pattern already established and lint-allowlisted in
`packages/ui/src/components/DataTable.tsx` for the same known axe/jsx-a11y conflict (a scrollable
non-interactive region legitimately needs `tabIndex` even though `jsx-a11y/no-noninteractive-tabindex`
disallows it by default) — a one-time fix in the shared component, so it also improves real report
pages, not just the new sample page. A second, unrelated bug surfaced by the same final gate run:
`homepage-conversion.spec.ts`'s "no real customer domain" test used an unscoped
`getByText("sample-domain.example")`, which matched both the intended visible heading text and an
`astro dev`-only debug artifact; fixed by scoping to `#main-content` with `{ exact: true }`,
consistent with the locator-scoping pattern already used elsewhere in this same test file.

## Starting point

- Branch created from `main` at `abab3d4` (Phases 0-3 merged, PRs #68-#71).
- Current section order (14 sections), strengths, weaknesses, and preserved-behaviour list captured
  in full in `docs/design/PHASE_04_HOMEPAGE_BASELINE.md` before any edit was made.
- Existing strengths reconfirmed and deliberately preserved: zero prohibited claims, zero
  fabricated proof, existing purpose separation, correctly labelled synthetic report preview,
  H1 already SRS §2.2-aligned and Phase-2-validated.

## Information architecture

Full audience-journey table and 12-section order/rationale/dependency table in
`docs/design/HOMEPAGE_INFORMATION_ARCHITECTURE.md`. Summary of the new order: (1) Hero,
(2) Three crawler-policy risks, (3) Sample report preview, (4) How CrawlPact works,
(5) Crawler purposes explained, (—) crawler directory preview, (6) Agency and multi-domain
workflow, (7) Independent evidence and methodology, (8) Supported signals, (9) Monitoring and
change detection, (10) Pricing preview, (11) FAQ, (12) Final audit CTA.

## Hero

**Retained, not rewritten.** The H1 ("Audit and monitor your website's AI crawler policy.") and
primary CTA label ("Audit a domain", not "Audit a domain free") were both explicitly reviewed and
kept as-is — changing either would have silently reversed a deliberate Phase 2 correction
(`docs/brand/MESSAGING_SURFACE_INVENTORY.md` rows A1/A5) and created a fresh, avoidable SRS §2.2
deviation with no mandate in this phase's own instructions to touch it. Supporting copy, CTA
hierarchy (primary "Audit a domain" / secondary "View a sample report"), and hero visual treatment
were the actual scope of this phase's hero work. Full reasoning recorded in
`docs/design/PHASE_04_HOMEPAGE_BASELINE.md`'s "Phase 4 implementation decisions" section.

## Sample report

New route `/sample-report` (`apps/web/src/pages/sample-report.astro`, `prerender = true`, fully
static). Renders `AuditReportView` — the exact component real audit results use — against a new
typed fixture (`apps/web/src/lib/sample-report.fixture.ts`) validated at test time with
`auditReportResponseSchema.parse()`, so the fixture can never drift out of shape from the real
contract. Domain is `sample-domain.example` (RFC 2606 reserved TLD, cannot resolve as or be
confused with a real domain). A persistent, non-`print` banner states "Sample report — demonstrates
report structure using a fictional domain. This is not a live audit of your website." The page ends
with a CTA back to the hero audit form. Declared **indexable** (not `noindex`) — decision and
rationale recorded in `docs/design/HOMEPAGE_CONTENT_MODEL.md`, since the page provides substantive
educational value rather than being a thin conversion fixture. The homepage's own
`SampleReportSection` shows the existing compact `ReportPreview` plus one real finding pulled from
`SAMPLE_REPORT.findings[0]` — the same fixture, so the homepage teaser and the full page can never
disagree.

## Agency section

New `AgencySection.astro` makes the primary commercial audience (agencies/consultants managing
multiple client domains) visible as its own section rather than one of six equally weighted
audience cards. Describes a 6-step real workflow and two capability cards (portfolio monitoring,
client-ready sharing) built only from capabilities already classified `verified-capability` in
`docs/brand/CLAIMS_AND_MESSAGING_GUIDE.md` (domain groups, batch import, monitoring, agency
branding — all already live and described elsewhere in the product). The component's own comment
states explicitly that no client portal, team-role, or ownership-verification functionality is
implied, since none exists. CTAs: "Review Agency pricing" → `/pricing#agency`, "View a sample
report" → `/sample-report`.

## Trust and evidence

Section 7 ("Independent evidence and methodology") displays `BRAND.approvedBoundaryStatement`
verbatim and links to all six required trust surfaces: Methodology, Crawler directory, Status,
Security, About, and the content/registry-correction process (added in Phase 3's `/methodology`
update). No new trust claim was introduced — this section only surfaces trust content that already
existed on other pages.

## Pricing

`pricing.astro`'s inline `plans` array was extracted into `apps/web/src/lib/plans.ts` (4 plans,
same prices/domains/monitoring/CTA values, byte-for-byte value parity — no price, limit, or
entitlement changed) and both `pricing.astro` and the new `PricingPreviewSection.astro` now import
the one array. This closes a real data-duplication risk (two independently hand-typed copies that
could silently drift) without attempting the deeper fix (sourcing plans from the database `plans`
table instead of a source file), which remains explicitly Phase 6's scope. `pricing.astro` plan
cards gained `id`/`scroll-mt-20` so `/pricing#<planId>` anchors resolve correctly from the new
homepage pricing preview.

## Implementation files

**New:**

- `apps/web/src/pages/sample-report.astro`
- `apps/web/src/lib/sample-report.fixture.ts` + `sample-report.fixture.test.ts`
- `apps/web/src/lib/plans.ts` + `plans.test.ts`
- `apps/web/src/components/homepage/RiskSection.astro`
- `apps/web/src/components/homepage/SampleReportSection.astro`
- `apps/web/src/components/homepage/CrawlerPurposeSection.astro`
- `apps/web/src/components/homepage/AgencySection.astro`
- `apps/web/src/components/homepage/PricingPreviewSection.astro`
- `apps/web/src/components/homepage/homepage-sections.test.ts`
- `apps/web/tests/e2e/homepage-conversion.spec.ts`
- `docs/design/PHASE_04_HOMEPAGE_BASELINE.md`
- `docs/design/HOMEPAGE_INFORMATION_ARCHITECTURE.md`
- `docs/design/HOMEPAGE_CONTENT_MODEL.md`
- `docs/design/HOMEPAGE_COMPONENT_MAP.md`

**Modified:**

- `apps/web/src/pages/index.astro` — rebuilt to the 12-section IA
- `apps/web/src/pages/pricing.astro` — imports shared `PLANS`, adds plan-card anchors
- `apps/web/src/components/AuditReportView.tsx` — accessibility fix (scrollable table region)
- `apps/web/src/lib/analytics.ts` — 5 new `PRODUCT_EVENT_NAMES` entries
- `apps/web/src/pages/sitemap.xml.ts` — `/sample-report` added
- `apps/web/tests/a11y/home.spec.ts` — `/sample-report` added to route coverage
- `apps/web/tests/e2e/responsive-smoke.spec.ts` — 1440/1920 viewports and a sample-report overflow
  check added
- `docs/design/ACCESSIBILITY_REQUIREMENTS.md` — known-gaps entry for the WebKit skip-link limitation
- `docs/README.md`, `docs/governance/DOCUMENTATION_INVENTORY.md`,
  `docs/governance/GITHUB_GOVERNANCE_SETUP_MANIFEST.md`,
  `docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md`, `CHANGELOG.md` — cross-references

## Analytics

No new client-side infrastructure was added. Homepage click analytics use a single non-hydrated
inline `<script>` in `index.astro` implementing native DOM event delegation on
`[data-analytics-event]`, POSTing to the existing `/api/analytics/track` endpoint (first-party
only, per SRS §33/Part 2 Step 18 — no third-party vendor or pixel added). Five new event names were
added to the fixed `PRODUCT_EVENT_NAMES` union (enforced server-side by `isProductEventName()`):
`sample_report_clicked`, `homepage_pricing_clicked`, `homepage_agency_cta_clicked`,
`homepage_methodology_clicked`, `homepage_crawler_directory_clicked`. No hydration
(`client:load`/`client:visible`) was added to any homepage section — every new homepage component
is a static Astro component; the one new hydrated island (`AuditReportView`, via `client:load`) is
scoped to `/sample-report` only, not the homepage itself.

## Performance

Dev-server (`astro dev`) Lighthouse measurement was attempted first and discarded: numbers were
highly unstable between runs (LCP swung ~3.5s→~13s with no code change) because Vite serves every
file under `@crawlpact/ui`'s barrel-exported `index.ts` as a separate unbundled ESM module in dev
mode — a dev-server artefact, not a real regression. Methodology was corrected to measure the
actual **production build**: `main` at `abab3d4` was checked out into a separate `git worktree`,
built with `pnpm build`, and served statically alongside this branch's own production build, same
machine, same method, only the homepage code differing. Full methodology note and the following
table are in `docs/design/PHASE_04_HOMEPAGE_BASELINE.md`:

| Metric              | Before (`abab3d4`) | After (this branch) |
| ------------------- | ------------------ | ------------------- |
| Performance         | 99                 | 99                  |
| Accessibility       | 100                | 100                 |
| Best Practices      | 96                 | 96                  |
| SEO                 | 100                | 100                 |
| LCP                 | 2114 ms            | 2113 ms             |
| CLS                 | 0                  | 0                   |
| Total Blocking Time | 24 ms              | 0 ms                |
| Network requests    | 16                 | 14                  |

No material change — marginally lighter, despite the new route and additional homepage sections,
because no new client-side hydration was introduced on the homepage itself.

## Accessibility

- Fixed a real, previously-uncaught WCAG 2.2 AA violation: `AuditReportView`'s crawler-matrix table
  wrapper is now `role="region"`, `aria-label="Crawler access matrix table"`, `tabIndex={0}` —
  resolves the WebKit `scrollable-region-focusable` failure, confirmed by rerunning the full a11y
  suite before/after the fix (`/sample-report` moved from failing to passing).
- Exactly one `<h1>` per page maintained; every new section uses one `<h2>` in document order.
- `/sample-report`'s "Sample report" label is a `Banner` (`role="status"`), not a heading, to avoid
  introducing a second H1.
- No color-only status indication introduced (`StatusChip` always pairs tone with a text label).
- One pre-existing, environment-only limitation reconfirmed and documented (not fixed, because
  there is nothing to fix in application code): Playwright's `mobile-safari` (WebKit) project does
  not include plain `<a>` links in the Tab order unless "Full Keyboard Access" is enabled, matching
  real Safari's own default behaviour. Reproduced identically against the pre-Phase-4 baseline
  commit (`abab3d4`) with zero homepage code changed, confirming it is not a Phase 4 regression.
  Recorded in `docs/design/ACCESSIBILITY_REQUIREMENTS.md`'s "Known gaps" section. The skip link
  itself is real, visible-on-focus, and functions correctly under Chromium and in real-world
  keyboard-only browsers.
- Two additional WebKit-only flaky results seen during the full a11y run (`/dev/components`, one
  guide page's 400%-zoom reflow check) are unrelated to any Phase 4 file and did not reproduce
  consistently — test-runner timeout flakiness on unrelated pages, not a homepage defect.

## Validation

| Command                                                                                                                                    | Result                              | Notes                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm run format:check`                                                                                                                    | ✅ Pass                             | after `pnpm run format`                                                                                                                                                  |
| `pnpm run lint`                                                                                                                            | ✅ Pass                             | 0 errors, `--max-warnings=0`                                                                                                                                             |
| `pnpm run typecheck`                                                                                                                       | ✅ Pass                             | 0 errors (pre-existing third-party `zod`/`FormEvent` deprecation hints only)                                                                                             |
| `pnpm run test:unit`                                                                                                                       | ✅ Pass                             | 276 tests, 31 files (3 new: `plans.test.ts`, `sample-report.fixture.test.ts`, `homepage-sections.test.ts`)                                                               |
| `pnpm run test:integration`                                                                                                                | ✅ Pass                             | 149 tests, 24 files                                                                                                                                                      |
| `pnpm run db:validate`                                                                                                                     | ✅ Pass                             | 40 tables verified                                                                                                                                                       |
| `pnpm run registry:validate`                                                                                                               | ✅ Pass                             | no issues found                                                                                                                                                          |
| `node scripts/brand-validate.mjs`                                                                                                          | ✅ Pass                             | 488 files scanned; 1 pre-existing warning on `/contact` (unmodified this phase, last touched at `abab3d4`)                                                               |
| `node scripts/trust-validate.mjs`                                                                                                          | ✅ Pass                             | 360 files scanned                                                                                                                                                        |
| `node scripts/docs-validate.mjs`                                                                                                           | ✅ Pass                             | 9 required files present                                                                                                                                                 |
| `pnpm run build`                                                                                                                           | ✅ Pass                             | verified `dist/client/sample-report/index.html` prerendered alongside all existing routes                                                                                |
| `bash scripts/secret-scan.sh`                                                                                                              | ✅ Pass                             | no known secret patterns                                                                                                                                                 |
| `pnpm test:a11y` (full, chromium + mobile-safari)                                                                                          | ✅ Pass (with documented exception) | 157-159/168 passed depending on run; only failures are the pre-existing WebKit skip-link limitation (see above) and unrelated flaky WebKit timeouts on non-Phase-4 pages |
| `pnpm exec playwright test --project=chromium` (full e2e, incl. new `homepage-conversion.spec.ts` and extended `responsive-smoke.spec.ts`) | ✅ Pass                             | see below                                                                                                                                                                |

Full e2e run (chromium, all specs including the 13 new `homepage-conversion.spec.ts` tests and the
extended `responsive-smoke.spec.ts` at 360/768/1280/1440/1920px) was run against a live local dev
server as the final check before this report: **74/74 passed** on the final run, after fixing the
locator-ambiguity bug described in the Executive summary (the first run surfaced 1 real failure in
a newly written test, not application code).

## Deferred work

This phase's actual execution scope, per its own instructions, did **not** include:

- Reconciling SRS §2.3's Primary Tagline with the Phase 2 brand system (RISK-028) — still open,
  unclaimed by Phases 2, 3, or 4. Carried forward to Phase 5.
- Adding `"description"` fields to the `package.json` files that lack one — carried forward to
  Phase 5.
- Sourcing `plans.ts` from the database `plans` table instead of a source file — remains Phase 6's
  scope, unchanged by this phase's narrower duplication fix.
- A contextual anonymous-report CTA and audit-to-account continuity — explicitly Phase 5 scope.
- Real aggregate proof metrics (customer counts, ratings) — explicitly out of scope for this
  product stage; routed to Phase 16 if/when real usage data exists to report honestly.

All deferred items are recorded in `docs/governance/GITHUB_GOVERNANCE_SETUP_MANIFEST.md`'s Phase 4
update section and in the roadmap's Phase 4/5 entries — not silently dropped.

## Runtime impact

**This phase changes homepage/pricing page content, adds one new static route (`/sample-report`),
adds a shared `plans.ts` data module, and fixes one accessibility defect in a shared report
component. It does not change crawler evaluation logic, crawler-registry contents, database
schema, authentication, billing logic, Paddle configuration, pricing/entitlement values,
monitoring, analytics implementation beyond adding declared event names, or Cloudflare
infrastructure.**

## Deployment

**No production deployment occurred as part of this phase.** The redesigned homepage and new
`/sample-report` route will only be visible on crawlpact.com once a `deploy-production.yml` run is
explicitly authorised — per the user's own stated plan, this is intended to happen next, as one
combined production release covering Phases 2, 3, and 4.

## Rollback

This phase's changes are page/component/copy/data-module/test/doc-only — no data migration or
infrastructure change. Revertible by reverting the pull request.

## Next phase

Phase 5 (Anonymous Audit Result and Account-Conversion Flow) can proceed once this phase is merged
and, per the user's explicit instruction, a combined production release of Phases 2, 3, and 4 has
been completed and confirmed. Phase 5 inherits the two unclaimed backlog items noted above
(RISK-028 tagline reconciliation, `package.json` descriptions).
