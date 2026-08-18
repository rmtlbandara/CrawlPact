# Phase 19: Pricing Comparison Table Strengthening

Status: current-authoritative, 2026-08-18. A focused Pricing-page UX improvement — no pricing,
entitlement, or checkout-architecture change. See
`docs/billing/APPROVED_PRICING_AND_ENTITLEMENT_MATRIX.md` for the unchanged source-of-truth
values this page renders.

## Problem

The pre-existing comparison table (`PricingPlans.tsx`) was one 11-row table led with "Price,"
which read as a plan-limits spreadsheet rather than communicating the one commercial fact that
matters most: every plan — Free included — gets the same complete audit. Paid plans differ on
scale, monitoring, history, and workflow, not audit quality. The table also required horizontal
scrolling on mobile with no orientation aid, and used bare "Yes"/"No" cells that convey their
meaning largely through position rather than clear text.

## Design

Added a short "Every plan includes the full audit" message above the comparison, then split the
single table into four semantic sections (Core audit & reports; Domains, history & monitoring;
Portfolio workflows; Agency capabilities), each its own `<table>` with a caption, proper
`scope="col"`/`scope="row"`, and a keyboard-focusable scroll region with a unique accessible name.
Cells use "Included" (with a `✓`, decorative/`aria-hidden`) or "—" with an `sr-only` "Not
included" — never colour alone. Each section's plan-column headers repeat the plan name and the
currently-selected interval's price (from the same `plans` prop, never a second price value) and
give Pro a subtle `bg-brand-50` tint plus its "Most Popular" label, without visually suppressing
the other plans. A restrained final CTA ("Audit a domain free") closes the section. Plan cards
were left unchanged.

## Source-of-truth

All entitlement and price values still flow through the existing chain
(`D1 plans → getPlan() → getPlanCatalog()` and `D1 plan_prices → resolveCheckoutPrice()`,
unchanged) into the same `PricingPlanEntry[]` prop `pricing.astro` already built. The new
`apps/web/src/lib/pricing-comparison.ts` module holds only section ordering, row labels/
descriptions, and pure formatting functions (`formatAutomaticMonitoring`,
`formatHistoryRetention`, `planPriceLabel`) — every `cell()` reads its answer directly off the
`PricingPlanEntry` passed in. It stores no plan-specific entitlement value, so it cannot drift
from `plan-catalog.ts`. Seven "core audit" rows (complete audit, crawler matrix, evidence-based
findings, deterministic recommendations, supported signals, print-friendly reports, private
report sharing) are marked `universal: true` and always resolve to "Included" — they are product
invariants (confirmed by reading `/api/audit`'s scan/share code paths, which have no plan
branching except `agencyBrandingEnabled` on shared-report branding), not a second entitlement
source.

### Bug found and fixed in passing

The previous single-table implementation pre-rounded `historyRetentionDays / 30` in
`pricing.astro` before handing it to the component. That produced two live display defects for
the History row: Free's 30-day retention rounded to `Math.round(30/30) = 1`, which the component
then rendered as "1 month" — the "else 30 days" branch was unreachable dead code — and Agency's
1095-day retention rounded to `Math.round(1095/30) = 37` ("37 months," since 1095/30 is exactly
36.5 and `Math.round` breaks ties up). Fixed by passing the raw `historyRetentionDays` through and
computing `formatHistoryRetention()` from the exact day count (`days * 12 / 365`, which recovers
whole months exactly for the stored whole-year values). Regression-tested in
`pricing-comparison.test.ts`. No entitlement value changed — Free's retention is still 30 days,
Agency's is still 1095 days (36 months) — only the earlier-broken display text is corrected.

## Accessibility

Real `<table>` elements throughout, `sr-only` `<caption>` backed by a preceding visible `<h3>`
(the same pattern already used on `/observatory/registry`), `scope="col"`/`scope="row"`, and the
existing `overflow-x-auto` + `tabIndex={0}` + `role="region"` scrollable-region pattern (from
`AuditReportView.tsx`) applied per-section with a unique `aria-label` each, so four independent
scroll regions are individually announced. A `sm:hidden` "Swipe horizontally to compare plans"
hint appears on mobile only. Included/Not-included state is never colour-only.

### Second bug found and fixed in passing: real page-level horizontal scroll at 320px

`forced-colors-and-zoom.spec.ts`'s existing 320px reflow check (already covering `/pricing`
before this change) started failing after splitting the one table into four sibling
`overflow-x-auto` regions: `document.documentElement.scrollWidth` measured 460px at a 320px
viewport. Bisection (temporarily `display:none`-ing each region and re-measuring, done against
the real running page, not guessed) showed every region contributed some of the excess, even
though each region's own `getBoundingClientRect()` and the enclosing `<section>`'s were already
correctly bounded at ~288px — and confirmed for real via `window.scrollTo(1000, 0)`, which
actually moved `window.scrollX` to 140, i.e. a genuine, user-triggerable sideways pan, not just a
stale JS property. This is a known Chromium behavior where a scroll container's clipped content
extent can still be counted toward the document root's `scrollWidth` unless the container
establishes explicit CSS containment. Fixed by adding `contain: paint` to each region's wrapper
div (`[contain:paint]` in `PricingPlans.tsx`), verified live to bring `scrollWidth` back to
exactly 320. The old single-table implementation never hit this because it only had one such
region. Regression-covered by `forced-colors-and-zoom.spec.ts`'s existing `/pricing` case (both
Chromium and mobile-safari) — no new test needed, the existing one now exercises the fix.

## Tests

- `apps/web/src/lib/pricing-comparison.test.ts` — data-truth coverage for all four plans across
  every row (including the history-retention regression above), the universal-core-features
  invariant, private-report-sharing staying non-Agency-gated, Agency-branding staying Agency-only,
  a forbidden-claims substring check against every row label/description, and `planPriceLabel`.
- `apps/web/src/lib/billing/plan-catalog.test.ts` — Pro is the only `recommended` plan.
- `apps/web/tests/e2e/pricing.spec.ts` — real-browser coverage of the four rendered sections, Pro
  Most Popular / Agency not, universal rows showing Included ×4, Agency-branding gating,
  representative entitlement values, the Monthly/Yearly toggle updating comparison header prices,
  and CTA hrefs (Pro preserves plan+interval, Free and the final CTA point to `/audit`).
- Existing suites re-run clean and unmodified in logic: `checkout-continuity.spec.ts` (still
  covers the full sign-up → `/app/billing` round trip) and `responsive-smoke.spec.ts` (still
  covers `/pricing` at 360/768/1280/1440/1920 with no page-level horizontal overflow).

## Result

Full `pnpm run test:unit` (459 tests) and `pnpm run test:integration` (352 tests) pass. Typecheck
and lint are clean on every touched file. `brand:validate`, `trust:validate`, `content:validate`,
`analytics:validate`, `repo-privacy:validate`, and `docs:validate` all pass. The `/pricing` axe-core
WCAG 2.2 AA scan (`home.spec.ts`) and the 320px reflow / forced-colors checks
(`forced-colors-and-zoom.spec.ts`) pass on both Chromium and mobile-safari, including the
`contain:paint` fix above. No D1 migration. No Paddle ID, price, or entitlement value changed —
cross-checked live against Paddle production (`client.prices.list`) before this change: all six
active production prices (Solo/Pro/Agency × month/year) match
`packages/database/seed/reference-data.sql` exactly. See the PR description for the release
commit trail and production verification record.
