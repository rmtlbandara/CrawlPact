# Public Status and Changelog Trust Correction — Completion Report

## Starting state

- Starting commit: `6648930` (main, "docs: record production deployment of Phase 11 (#88)").
- Production deployment: Worker version `7d1b4cc4-2232-4c21-9f91-5b154f94e5c2`, matching the
  starting commit.
- **Current public overall status at the start of this pass: "Degraded performance"** — confirmed
  live via a direct `curl` of `https://crawlpact.com/status` before any change was made.
- **Current Billing and checkout public status: "Degraded performance"** — same live check.
- **Current Billing and checkout internal status**: also effectively "degraded" per the pre-fix
  `getComponentHealth` logic, but for the wrong reason — an all-time (no time window) count of 20
  `webhook_events` rows in `failed` status, all dated 2026-07-28/29 (roughly a week before this
  pass), with **zero** failures in the 24 hours immediately preceding this pass (confirmed via a
  real production D1 query). Paddle's own delivery log (queried read-only via the Paddle API)
  independently confirmed 0 failed notifications and the most recent deliveries all succeeded —
  three independent sources (public page, D1, Paddle) agreed the public "Degraded performance" was
  not reflecting real current user impact.
- Existing uptime wording: `apps/web/src/pages/status.astro` rendered "CrawlPact does not yet have
  reliable historical uptime measurement in place, so no uptime percentage is published here. This
  section will show real measured history once that exists — not before." under a "Historical
  uptime" heading, and separately linked `docs/status/IMPLEMENTATION_STATUS.md` in its footer.
- Existing changelog introduction: led with a registry-vs-product distinction only, with no
  production-appropriate framing sentence; one hardcoded product entry's title read "(Part 3, in
  progress)" despite Part 3 having been complete for a long time — both stale and, independently,
  matching the prohibited "work in progress" wording pattern.
- `docs/status/IMPLEMENTATION_STATUS.md` usage: the file itself no longer exists at that path —
  it was already correctly archived to `docs/archive/implementation-history/IMPLEMENTATION_STATUS.md`
  during Phase 1 (2026-08-03), with a proper historical notice pointing at
  `docs/status/CURRENT_STATE.md`. The only live problem was `status.astro`'s footer still linking
  the old, now-nonexistent path — a dead link exposing an internal-history reference publicly.

## Verification

Billing and checkout was verified against real, current production/Paddle evidence — no real
payment, refund, subscriber mutation, Paddle product/price/webhook-configuration change was made:

1. `/pricing` returns `HTTP 200` (confirmed via `curl`).
2. All 6 required production plan/interval combinations (solo/pro/agency × month/year) have
   exactly one active-for-new-checkout `plan_prices` row each (queried directly from production
   D1) — zero missing-mapping or duplicate-mapping flags under the existing
   `computeCatalogStatusFlags` logic.
3. Same query confirms the server-side plan/interval → Paddle price ID mapping is correct and
   unambiguous.
4. Checkout initiation was verified at the mapping/configuration level (items 2–3) rather than by
   driving a real Paddle Checkout session to completion, per this task's explicit "do not perform
   a real payment" constraint.
5. The checkout domain is valid: Paddle's own notification-settings API confirms the registered
   webhook destination is `https://crawlpact.com/api/billing/webhook` — the real production domain.
6. Webhook destination enabled: confirmed `active: true` directly from Paddle's
   `notificationSettings.list` API (2 real settings on the account, one production).
7. Recent webhook processing: 0 failures in the last 24 hours (production D1), 0 failed
   notifications in Paddle's own delivery log, most recent deliveries all `delivered`.
8. Billing portal path (`/api/billing/portal-session.ts`) exists in the codebase and is wired into
   the account UI (not independently re-verified live, since it requires an authenticated session
   to exercise — no code change was made to it).
9. No active Billing and checkout incident: `incidents` table queried directly, 0 rows exist at
   all in production.
10. No other current evidence of degradation was found across any of the above.

**Public-impact decision**: Billing and checkout → **Operational**.

## Status implementation

- **Public/internal separation** (the real bug, and its fix): `ComponentHealth`
  (`apps/web/src/lib/admin/health.ts`) gained a `publicImpact: boolean` field. `getPublicStatus`
  (`apps/web/src/lib/status/public-status.ts`) now only escalates a component's _public_ level
  when the matched internal check's `publicImpact` is `true` — an internal `degraded` with
  `publicImpact: false` stays visible internally only. The `Paddle webhook processing` check's
  underlying query gained a real 1-hour time window (it previously had none at all — the root
  cause) and its `publicImpact` is `true` only at 3+ recent failures (a real pattern, not an
  isolated blip; a single recent failure still surfaces internally immediately, matching this
  codebase's existing "no safe gradual zone for a real error" convention, but is not yet treated
  as confirmed public impact). `API` (maintenance mode) and `Authentication` (an already
  time-windowed, high-bar check) are `publicImpact: true` when degraded, since both represent real,
  current, user-facing conditions; `Scheduler / monitoring sweep` and `Data retention job` are
  `publicImpact: false` always — background-job concerns with no immediate effect on a page load.
- **Overall aggregation**: unchanged in mechanism (worst-of-components, plus active public
  incidents/maintenance) — the fix is entirely in what reaches the aggregation as an input.
  `getSystemStatusSummary`'s own foundational level was already correctly gated (only
  `maintenance` escalates it; a general `degraded` reason never did) — confirmed by reading it,
  not assumed.
- **Super Admin presentation**: `GET /api/admin/health` additively returns a new `statusOverview`
  field (existing `summary`/`components` fields unchanged — no existing consumer broken). A new
  `getStatusOverview(db)` function combines `getPublicStatus` and `getComponentHealth` output side
  by side: per component, `publicStatus`, `internalStatus`, `internalReason`, `publicImpact`,
  `verificationSource`, and any linked active incident; overall, `publicOverall`, `internalOverall`
  (computed from _every_ real internal check, not just the subset with a public mapping — a real
  bug in this same pass's own new code, caught by its own test before shipping, see below),
  `hasPublicImpact`, `activePublicIncidentCount`, `internalWarningCount`. `HealthOverview.tsx`
  (`/admin/health`) renders all of this with every field clearly labelled "Public:" / "Internal:" —
  never two unlabelled badges.
- **Public page changes**: `status.astro` gained a plain-language overall-status summary sentence
  per component state (the "All public CrawlPact services are operating normally." wording, plus
  analogous sentences for the other five states) — previously only the raw level label rendered,
  with no supporting sentence.
- **Incident handling**: unchanged — verified via a real test that an active public incident still
  correctly escalates the public page regardless of any internal-only signal.

## Uptime wording

- Sentence removed: "CrawlPact does not yet have reliable historical uptime measurement in place,
  so no uptime percentage is published here. This section will show real measured history once
  that exists — not before." (and its "Historical uptime" heading).
- Replacement: none — no new heading or explanatory sentence was added in its place. The page's
  existing "Recently resolved" section already serves the neutral service-history role a visitor
  needs; duplicating it under a second "Service history" heading would have been redundant. This
  was a deliberate choice, recorded in `docs/architecture/INCIDENT_TRACKING_SYSTEM_DESIGN.md` §2
  (updated) so a future maintainer doesn't have to re-derive why no replacement section exists.
- Confirmation no uptime percentage was invented: `scripts/status-validate.mjs` includes a
  dedicated regex check (`\d{1,3}(\.\d+)?%\s*(uptime|availability)`) run against every public
  source file, plus a matching real e2e assertion against the live rendered page — both pass.

## `IMPLEMENTATION_STATUS.md` decision

**Already archived** (Phase 1, 2026-08-03) — no action needed on the file itself, which correctly
carries a historical notice at `docs/archive/implementation-history/IMPLEMENTATION_STATUS.md`.
The real, live problem this pass found and fixed was `apps/web/src/pages/status.astro`'s footer
still linking the old, pre-archive path (`docs/status/IMPLEMENTATION_STATUS.md`) — a dead link
exposing an internal-history reference on the public page. That link was removed (the footer now
only links `/security`). `scripts/status-validate.mjs` gained a dedicated check preventing this
specific path string from ever reappearing in `apps/web/src`.

## Changelog

- Introduction before: "Two separate kinds of change are tracked here. A registry release reflects
  new information about crawlers — it is never a change to your website (FR-REG-009/010). A
  product entry reflects a change to CrawlPact itself."
- Introduction after: leads with "Meaningful CrawlPact product, reliability, security, and content
  improvements are recorded here after they are deployed and verified." (the prompt's own
  recommended wording), followed by the original registry-vs-product distinction unchanged — that
  distinction remains genuinely necessary product information, not trust-reducing wording, so it
  was preserved rather than replaced.
- Entry wording changed: the "Super Admin, agency features, and SEO content" entry's title dropped
  "(Part 3, in progress)" → "(Part 3)" — both factually stale (Part 3 has long been complete) and,
  independently, matching the prohibited "work in progress" pattern.
- Internal details removed: none were present in the public changelog to begin with (no
  internal-only debugging language, issue references, or infrastructure detail found on review).
- No new historical entries were fabricated or backfilled for Phases 4–11 — out of this
  correction's scope per its own "Add a changelog entry for this change only after it is deployed
  and verified" instruction. `CHANGELOG.md` (the internal engineering changelog, a different
  document from the public `/changelog` page) already has its own separate, accurate record of
  every phase.

## Tests

| Command                                                                                                                                  | Result                     |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `pnpm run status:validate`                                                                                                               | PASSED (385 files scanned) |
| `pnpm run trust:validate`                                                                                                                | PASSED (400 files scanned) |
| `pnpm run docs:validate`                                                                                                                 | PASSED                     |
| `pnpm run brand:validate`                                                                                                                | PASSED (528 files scanned) |
| `pnpm run quality` (format, lint, typecheck, unit, integration, db:validate, content:validate, build)                                    | PASSED                     |
| `pnpm run verify:push` (full local CI reproduction: the above plus 111 Chromium E2E tests, 97 Chromium accessibility tests, secret scan) | PASSED                     |

New tests added:

- `apps/web/tests/integration/public-status.integration.test.ts` (5 tests, real D1) — reproduces
  the exact production bug (20 stale failures must not degrade the public page), proves a genuine
  recent pattern (3+ failures) does degrade it, proves a single recent failure stays internal-only,
  proves `getStatusOverview`'s combined view is correct including the `internalWarningCount` for a
  component with no public mapping at all, and proves a real active incident still correctly
  escalates the public page regardless of internal-only signals.
- `apps/web/tests/integration/admin-scheduler-health.integration.test.ts` — 1 new test asserting
  `/api/admin/health`'s new `statusOverview` field is present and correctly gated (a real internal
  `degraded` state from a failed retention job does not leak to `publicOverall`).
- `apps/web/tests/e2e/status-changelog-trust.spec.ts` (8 tests, real browser) — public overall
  status is visible and never colour-only; the removed sentence and any fabricated percentage are
  absent from the real rendered page; the archived doc is never linked; no internal-only detail
  string (`scheduled_job_runs`, `webhook_events`, `security_events`, `"in the last hour"`) appears
  in the public page's source; Billing and checkout renders Operational on a clean local
  environment; the changelog introduction renders correctly; `/admin/health` redirects an
  unauthenticated request to sign-in; the authenticated Super Admin view renders every required
  labelled field.
- `scripts/status-validate.mjs` — new, dedicated static validator (regex-scanned against every
  public source file): the removed sentence and its close negative variants, a fabricated
  uptime/availability percentage, generic trust-reducing wording, a reference to the archived
  `IMPLEMENTATION_STATUS.md` path, and (structurally) that `status.astro` never imports an
  internal-only status function. Sanity-checked to actually fail on a real reintroduced violation,
  not just pass trivially, before being kept.

A real bug in this pass's own new code was caught and fixed by its own test before shipping: the
first version of `getStatusOverview`'s `internalOverall` computation only considered internal
checks that had a public-component mapping, silently under-reporting the true internal severity
whenever a mapping-less check (like the retention job) was the actual degraded one — exactly the
kind of gap Super Admin's "internal overall state" exists to surface. Fixed to derive
`internalOverall` from every real internal check.

## Scope confirmation

This correction changes only public status presentation, internal/public status separation, Super
Admin status visibility, changelog wording, status-related documentation, and directly related
validation. It does not change billing behaviour, checkout behaviour, Paddle configuration,
pricing, plans, crawler evaluation, monitoring, authentication, database schema, or unrelated
infrastructure.

## Deployment

Not yet deployed as of this report. Per this repo's standing rule, production deployment requires
fresh, explicit, in-the-moment approval — requested separately after merge, matching the pattern
used for every prior phase/correction in this repository.
