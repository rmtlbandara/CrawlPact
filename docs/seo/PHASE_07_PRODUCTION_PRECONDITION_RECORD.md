# Phase 7 production precondition record

Written before any Phase 7 code changed, per the phase prompt's mandatory-precondition
requirement. All checks below were run directly against `https://crawlpact.com` and this
repository's state on 2026-08-04, before branching.

## Repository state

- **Default branch**: `main`, HEAD at `dc299fb` ("docs: record production deployment of Phase 6
  (#81)").
- **Phase 6 production commit**: `16d586419d09c2df39dc1411d079a21a18af0dd2` (PR #80), deployed
  2026-08-04. Docs-only follow-up `dc299fb` (PR #81) also merged and does not itself redeploy
  anything (no application code changed).
- **Working tree**: clean at branch time (`git status` — nothing to commit).
- **Phases 0–6**: confirmed merged to `main` (PRs #68–#81 all present in `git log --oneline`) and
  the completion report for each phase exists under `docs/reports/`.

## Phase 6 production deployment evidence

- Deployed Worker version ID: `7ed25286-f394-4517-aca6-5fe5168b41a4`.
- Build artifact checksum: `c3f65964f0aae4196ef6b806a288fd307c6baef8dc6e24eb499493785c23f293`.
- Migration `0021_plan_prices.sql` applied to production D1; reference-data seed step ran
  successfully (now automated on every deploy — see
  `docs/billing/BILLING_DEPLOYMENT_AND_ROLLBACK_RUNBOOK.md`).
- Full detail: `CHANGELOG.md`'s "Production deployment (2026-08-04) — Phase 6" entry and
  `docs/reports/PHASE_06_PRICING_PADDLE_CHECKOUT_COMPLETION_REPORT.md`.

## Live production checks (2026-08-04, immediately before Phase 7 branch creation)

| Check                                                   | Result                                                                                                                                                      | Evidence                                                                                                                                                                                                                                                             |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Homepage                                                | `200`                                                                                                                                                       | `curl -o /dev/null -w "%{http_code}" https://crawlpact.com/`                                                                                                                                                                                                         |
| Pricing page                                            | `200`                                                                                                                                                       | Same method, `/pricing/`                                                                                                                                                                                                                                             |
| Pricing page shows all 6 approved paid prices           | Confirmed                                                                                                                                                   | Page body contains `$9`, `$19`, `$39`, `$89`, `$189`, `$389` — all 6 monthly/yearly Solo/Pro/Agency prices, plus `$0` Free and a "Most Popular" badge on Pro                                                                                                         |
| No Paddle price ID leaked into pricing page HTML        | Confirmed                                                                                                                                                   | `grep -c "pri_"` on the page body returns `0` — price IDs are only ever returned via the authenticated checkout API response, never baked into public markup (see `docs/security/PHASE_06_BILLING_AND_CHECKOUT_THREAT_REVIEW.md`)                                    |
| Structured pricing data (`Offer` entries)               | 7 (Free + 3 paid plans × 2 intervals)                                                                                                                       | `grep -o '"@type":"Offer"'` count on `/pricing/`                                                                                                                                                                                                                     |
| Legacy prices excluded from new checkout                | Confirmed (code-level, re-verified)                                                                                                                         | `resolveCheckoutPrice()` filters `active_for_new_checkout = true` unconditionally — see `apps/web/src/lib/billing/plan-catalog.ts`; the 3 legacy annual prices remain mapped for existing subscribers only, per `docs/billing/LEGACY_PRICE_AND_SUBSCRIBER_POLICY.md` |
| `/app/billing` (unauthenticated)                        | `302` → `/sign-in`                                                                                                                                          | Confirms auth gate still correct post-Phase-6                                                                                                                                                                                                                        |
| `/admin/plans` (unauthenticated)                        | `302` → `/sign-in`                                                                                                                                          | Same                                                                                                                                                                                                                                                                 |
| `POST /api/billing/checkout` (cross-origin, no session) | `403 FORBIDDEN` (`Cross-site request blocked.`)                                                                                                             | CSRF defense-in-depth still live                                                                                                                                                                                                                                     |
| Anonymous audit route (`/audit`)                        | `200` (via `307` → `/audit/`, the expected prerendered-page trailing-slash behaviour — not a regression, see `scripts/smoke-test.ts`'s own comment on this) |                                                                                                                                                                                                                                                                      |
| Sample report (`/sample-report`)                        | `200` (same trailing-slash pattern)                                                                                                                         |                                                                                                                                                                                                                                                                      |
| Status page (`/status`)                                 | `200`                                                                                                                                                       |                                                                                                                                                                                                                                                                      |
| Crawler directory (`/crawlers`)                         | `200` (same trailing-slash pattern)                                                                                                                         |                                                                                                                                                                                                                                                                      |
| Sitemap (`/sitemap.xml`)                                | `200`                                                                                                                                                       |                                                                                                                                                                                                                                                                      |
| Robots.txt (`/robots.txt`)                              | `200`                                                                                                                                                       |                                                                                                                                                                                                                                                                      |

**No unresolved P0 production regression exists.** All capabilities the prompt requires as
operational preconditions (anonymous audit, sample report, audit-to-account conversion, pricing-
to-checkout continuity, status page, sitemap/robots.txt) are confirmed live and correct.

## Known, already-documented, non-blocking open risk

**RISK-001 (real paid Paddle checkout lifecycle has never been run) remains open.** Per this
phase's own prompt: _"A real charged Paddle transaction may remain an open documented risk when
it was not authorised. It does not automatically block Phase 7, but its status must not be
hidden."_ This is unchanged from Phase 6's own completion report and `docs/risks/ACTIVE_RISKS.md`
— disclosed here, not hidden, and does not block Phase 7 (an SEO/content phase with an explicit
prohibition on touching Paddle/checkout/pricing at all — see the phase prompt's §7.2).

## Documentation staleness found during this precondition check

`docs/status/CURRENT_STATE.md` and `docs/status/REQUIREMENTS_TRACEABILITY.md` are both stamped
"Last verified/corrected: 2026-08-03" and predate Phases 5 and 6 (`CURRENT_STATE.md` still cites
migration `0018_incidents.sql` and the old annual-only $79/$179/$399 catalog). This is pre-existing
documentation debt, not a Phase 7 regression — flagged here and corrected as part of this phase's
own governance-doc update pass (see the Phase 7 completion report), consistent with CLAUDE.md's
"documentation debt is not acceptable debt here" rule.

## Precondition result

**Passed — Phase 7 may proceed.** No P0 regression, no unresolved production incident, all
required-operational capabilities confirmed live, and the one open risk (RISK-001) is
already-documented, non-blocking, and out of this phase's scope by the phase prompt's own explicit
boundaries.
