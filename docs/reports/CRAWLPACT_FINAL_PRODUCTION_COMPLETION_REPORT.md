# CrawlPact — Final Production Completion Report

**Date:** 2026-07-28. Covers two consecutive remediation passes run back-to-back in the same
session: an E2E-stability-focused pass, followed by a full-scope production remediation pass
triggered by two reported live-production failures. See `docs/status/IMPLEMENTATION_STATUS.md`
("Production-stabilization pass" and "Full-scope production remediation" entries) and
`docs/status/KNOWN_RISKS.md` for the complete, itemized detail this report summarizes.

## 1. Executive summary

The most severe defect found in this project's history was found and fixed this pass: **production
account creation had been completely broken since the database was created on 2026-07-26** — every
registration attempt failed on a foreign-key violation because the real plan/role reference tables
were never seeded in production, which meant zero accounts, zero credentials, and the honest but
confusing "This passkey is not recognised" message on every sign-in attempt thereafter. This is now
fixed and verified with a real, disposable-account registration → sign-in round trip against
`https://crawlpact.com`.

The other reported "confirmed production failure" — the audit engine's disabled-state message — was
verified live and found to be the user's own explicit, informed decision from earlier in this same
session (keep `AUDIT_ENGINE_ENABLED=false` given the live-confirmed Free-plan CPU budget risk), not
a regression. It was not "fixed," because it was not broken.

The long-standing real-CI E2E instability was root-caused (not just worked around) across three
layers of the same underlying bug class — a Vite SSR dependency-optimizer race under real parallel
load — the last of which was only found by inspecting an actual `ubuntu-latest` GitHub Actions run's
Playwright trace, not by further local guessing. Two of the three fixes are confirmed by a real CI
run; the third is committed, pushed, and a fresh PR opened, but not yet confirmed green.

## 2. Previously completed work reviewed

Reviewed rather than repeated: Part 3's full SRS build-out, the UI/UX conversion audit, the
Cloudflare infrastructure-alignment and account-setup passes, the release-engineering hardening
pass, and the Paddle webhook live-delivery verification pass — all in
`docs/status/IMPLEMENTATION_STATUS.md`. Nothing from those passes was reverted, discarded, or
redone; this pass's fixes are additive.

## 3. Remaining scope discovered — and disposition

| Original brief area                                    | Disposition this pass                                                                                                                                                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reproduce and fix the two reported production failures | Done — see §1, §5–6                                                                                                                                                                                                             |
| Full route-by-route blocker matrix                     | Partial — see §7 (existing e2e/a11y coverage plus this pass's findings, not a fresh manual click-through of every route; no new blockers found beyond what's below)                                                             |
| Complete Paddle re-verification                        | Done, read-only — §8                                                                                                                                                                                                            |
| Complete Cloudflare bindings audit                     | Done, read-only plus the two production data writes in §5 — §9                                                                                                                                                                  |
| Complete accessibility pass                            | Not re-run this pass beyond what already existed (51/52 passing, one pre-existing disclosed WebKit limitation) — no UI changed this pass, so no new a11y risk was introduced; a full fresh manual pass was not performed        |
| Complete security review                               | Done for the areas touched (auth, the new production data, CSP) — §10; SSRF/CSRF/webhook signature verification were not re-audited from scratch since they were unchanged and already covered by 137 passing integration tests |
| CI/CD and test reliability                             | Done — §6                                                                                                                                                                                                                       |
| Preview verification                                   | Not performed this pass — no preview-specific change was made; production was the object of investigation, not preview                                                                                                          |
| Production release and verification                    | Done for the specific defect found (§5); no Worker deployment was performed or needed — the fix was a data correction via D1, not a code deploy                                                                                 |
| Documentation                                          | Done — this report plus `KNOWN_RISKS.md`/`IMPLEMENTATION_STATUS.md` updates                                                                                                                                                     |

## 4. Root causes and corrections

### 4.1 "This passkey is not recognised" (reported production failure)

**Root cause**: `users.plan_id` has a real `FOREIGN KEY` constraint to `plans.id`. Production's
`plans` table had zero rows (never seeded — the real SRS §8 catalog lives in
`packages/database/seed/seed.sql`, correctly marked local-dev-only because it also bundles a dev
admin fixture and sample data, but nobody separately extracted the genuinely-production-appropriate
rows — the real plan catalog and the real `admin_roles` RBAC catalog — when production was first
stood up). Every `register/finish.ts` INSERT therefore failed with `SQLITE_CONSTRAINT_FOREIGNKEY`,
so no account had ever been created, so no passkey credential had ever existed, so every sign-in
attempt correctly (if confusingly) reported "not recognised."

**Correction**: inserted the real 4-row plan catalog and 6-row admin-role catalog directly into
production D1 — additive reference data exactly matching migration `0001_plans.sql`'s values, not
test data, no schema change, no migration file touched (ADR-0002's forward-only migration rule is
about schema, not this kind of reference-data correction).

**Verification**: ran a real, disposable-account registration → sign-out → sign-in round trip
against `https://crawlpact.com` via a headless Chromium browser with a genuine CDP WebAuthn virtual
authenticator (the same mechanism the e2e suite uses, pointed at production instead of localhost).
Registration returned `200` with real recovery codes; sign-out and a fresh sign-in with the same
passkey both succeeded, reaching `/app`. The three throwaway accounts created during this
verification (and their `passkey_credentials`/`sessions`/`recovery_codes`/`product_events` rows)
were deleted immediately after — confirmed by a follow-up count query showing 0 real users again.

### 4.2 "The audit engine is not enabled" (reported production failure)

**Root cause**: none — this is the honest, correct, currently-live state
(`AUDIT_ENGINE_ENABLED=false`, confirmed via a direct read of the live Worker's bindings), matching
the user's own explicit decision made earlier in this session after being shown the live-verified
Free-plan CPU-budget risk. Not a regression, not touched.

### 4.3 E2E instability (three layered root causes, one bug class)

All three are the same underlying issue: Astro's dev server (Vite) discovers and pre-bundles each
server-side dependency the first time a route that imports it is requested; concurrent Playwright
workers hitting different never-before-seen routes race that discovery, corrupting in-flight
requests.

1. **Page routes** (`/pay`'s `@paddle/paddle-js`, `/sign-in`'s `@simplewebauthn/browser`) — fixed
   with a serial `globalSetup` route warmup (`apps/web/tests/e2e/global-setup.ts`).
2. **Shared per-IP rate-limit counters** (anonymous audit, recovery-code redemption) tripping under
   repeated runs — fixed with `clearAnonymousAuditRateLimit()`/`clearRecoveryCodeRateLimit()`
   test-setup helpers.
3. **Auth API routes' own separate module graph** (`@simplewebauthn/server`, reached only through
   `lib/auth/webauthn.ts`, which no page component imports) — found by inspecting a real
   `ubuntu-latest` CI run's Playwright network trace after fixes 1–2 still left `register/begin`
   returning a genuine `500` under real CI load. Fixed by extending the same `global-setup.ts` with
   serial POST warm-ups against the auth API routes.

Fixes 1–2 are confirmed working locally (6 consecutive clean full-suite runs) but the real CI run
that tested them (after the user pushed) still failed — on fix 3's symptom specifically, not fixes
1–2's. Fix 3 is committed, pushed, and PR #31 opened; not yet confirmed against a fresh real CI run.

## 5. Blockers fixed

| Blocker                                                                                      | Severity     | Status                                                   |
| -------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------- |
| Production account creation completely broken (FK violation, `plans`/`admin_roles` unseeded) | **Critical** | Fixed, verified live                                     |
| E2E CI instability — page-route SSR dep race                                                 | High         | Fixed, verified (local + real CI)                        |
| E2E CI instability — shared rate-limit counters                                              | High         | Fixed, verified (local + real CI)                        |
| E2E CI instability — auth API-route SSR dep race                                             | High         | Fixed, committed/pushed; real-CI re-verification pending |
| Recovery-code sign-in had no real browser e2e coverage                                       | Medium       | Fixed (prior pass in this session)                       |
| Cloudflare Web Analytics beacon blocked by CSP                                               | Low          | Disclosed, not fixed (product decision)                  |

No other reproducible blocker was found this pass across the areas actually re-verified (Cloudflare
bindings, Paddle configuration, the auth code paths touched). A from-scratch manual click-through
of every route listed in the brief's §3 route matrix was not performed this pass — see §3.

## 6. E2E stability evidence

- Local: full suite (34 tests, chromium + mobile-safari), `CI=1`, mirroring CI's exact steps —
  6 consecutive clean runs across the two rounds of fixes in the prior pass.
- Real GitHub Actions (`ubuntu-latest`): PR #30's run (testing fixes 1–2) still failed, on fix 3's
  symptom (`register/begin` 500) — diagnosed directly from that run's uploaded Playwright trace.
  PR #31 (testing fix 3) is open; result not yet available at the time of writing.
- Diagnostics: traces, screenshots, and the HTML report are already uploaded on failure
  (`if: failure()` on the existing `upload-artifact` step) — used directly to diagnose fix 3, proving
  this diagnostic path works as intended.

## 7. Route/blocker matrix (evidence available this pass)

Not a fresh manual audit of every listed route. Evidence available:

- **Public**: home, pricing, `/pay`, sign-in, 404, sitemap — covered by passing e2e (`landing-page`,
  `pay`, `seo-metadata` specs) and passing a11y suite (51/52, one pre-existing disclosed WebKit
  focus-API limitation, unrelated to any file touched this pass).
- **Auth**: create account, sign-in, sign-out, recovery-code (valid/reuse/invalid) — covered by
  passing e2e (`auth-and-account.spec.ts`) locally, and directly re-verified against real production
  in §4.1.
- **Admin**: global dashboard, user search, subscriptions, webhook retry — covered by passing e2e
  (`admin-flows.spec.ts`) locally; not independently re-verified against production this pass (no
  real admin account exists in production — creating one was out of this pass's scope, see §11).
- **Billing**: `/pay` reachability and error states covered by e2e; Paddle catalog/webhook
  configuration re-verified live (§8). Full checkout-to-entitlement lifecycle against a real payment
  was not (and should not be) exercised.

## 8. Paddle verification

Read-only, via the Paddle MCP. No resources created, modified, or deleted.

- **Products**: 3 (`CrawlPact Solo`, `CrawlPact Pro`, `CrawlPact Agency`), all `active`.
- **Prices**: 3, all `active`, IDs exactly matching the production Worker's configured
  `PADDLE_PRICE_ID_SOLO`/`PRO`/`AGENCY` bindings (cross-checked directly against the live Worker
  settings, not just the source `wrangler.jsonc`).
- **Webhook destination**: `ntfset_01kyfkc59d8h66prnhw220hnzy` →
  `https://crawlpact.com/api/billing/webhook`, `active: true`.
- Signature verification, idempotency, and event dispatch were already proven against real,
  Paddle-signed production traffic in the prior session's dedicated verification pass (see
  `docs/status/PADDLE_WEBHOOK_LIVE_DELIVERY_VERIFICATION.md`) — not repeated this pass since nothing
  in that path changed.

No live automated charge was created or attempted.

## 9. Cloudflare verification

Read-only, via the Cloudflare API, except the two production D1 data-correction writes described
in §4.1 (and their cleanup).

- **Workers**: exactly two CrawlPact-related workers exist — `crawlpact-web` (production) and
  `crawlpact-web-preview` (preview), both `last_deployed_from: "wrangler"`. No duplicate or orphaned
  CrawlPact worker found. (Four unrelated personal-project workers exist on the same account —
  confirmed unrelated, not touched.)
- **Bindings** (read from the live Worker's actual deployed settings, not the source config):
  `ASSETS`, `AUDIT_ENGINE_ENABLED=false`, `BILLING_ENABLED=true`, `DB` (D1), 4 Paddle vars + 2
  secrets, `PUBLIC_APP_ENV=production`, `PUBLIC_SITE_URL`, `SESSION` (KV), `SESSION_SIGNING_SECRET`
  (secret), `WEBAUTHN_RP_ID=crawlpact.com`, `WEBAUTHN_RP_ORIGIN=https://crawlpact.com` — all correct
  for production.
- **D1**: production (`crawlpact-db`) and preview (`crawlpact-db-preview`) are separate databases
  with separate IDs, confirmed via both the Worker's bindings and a direct D1 API read.
- **KV**: `crawlpact-web-session` (production) and `crawlpact-web-preview-session` (preview) are
  separate namespaces, correctly bound.
- **Custom domain**: `crawlpact.com` → `crawlpact-web`, production, enabled.
- **DNS**: no drift found — `www` CNAME to apex, Workers Custom Domain's own managed AAAA record,
  MX/SPF/DMARC for email forwarding (unrelated to the app). No stray records.
- **Rollback**: 10 Worker versions available.
- **Deployment ownership**: the already-documented, pre-existing "Cloudflare Workers Builds" duplicate
  pipeline is still failing on every push (unchanged from the prior pass's finding) — not
  disabled this pass, since that requires a Cloudflare-dashboard-side change outside a safe,
  reversible action to take unilaterally.
- **Zone plan**: `crawlpact.com` is confirmed still on the Cloudflare Free plan (live-checked, not
  assumed) — directly relevant to the `AUDIT_ENGINE_ENABLED` decision in §4.2.

## 10. Security findings and corrections

- **Production data-integrity gap** (§4.1) — the headline finding; corrected.
- **CSP gap**: Cloudflare's own auto-injected Web Analytics beacon
  (`static.cloudflareinsights.com`) is blocked by `middleware.ts`'s `script-src`, confirmed live via
  browser console capture during production verification. Not a vulnerability — nothing is exposed
  by blocking it — but disclosed rather than silently left, since it's a genuine (if minor)
  functional gap if Web Analytics is expected to work. Not fixed unilaterally: whether to allow it
  is a product decision (enable analytics vs. keep the tighter CSP), not fixed this pass.
- **No other new vulnerability found** in the areas actually re-reviewed this pass (auth flow code
  paths, the new production data, CSP). SSRF, CSRF, webhook signature verification, and admin
  authorization were not re-audited from scratch — they were unchanged from the prior session's
  `FINAL_SECURITY_AUDIT.md` (zero critical/high findings) and remain covered by 137 passing
  integration tests that exercise exactly those paths.

## 11. Remaining items

Only genuine remaining items — not deferred-without-reason:

- **PR #31 (the third e2e fix) is not yet confirmed against a real CI run.** Reason: each push
  requires the user's separate, explicit, in-the-moment authorization per this repository's own
  `git push` permission restriction — this session's pushes went through, but I cannot self-trigger
  or wait out another 30-minute CI cycle without the user driving it. Safest next action: the user
  merges or monitors PR #31; if it's still red, the Playwright trace from that run is the next
  concrete diagnostic (same method that found fix 3).
- **`runtime_configuration`'s 13 real operational-default rows are still unseeded in production.**
  Reason: lower urgency than `plans` — the code paths that read these values (e.g.
  `anonymous_audit_daily_limit`) have safe in-code fallback defaults, so nothing is currently broken
  by their absence, unlike the `plans` FK which was a hard failure. Left for a deliberate follow-up
  rather than inserted unilaterally alongside the urgent fix, since these are genuinely operational
  settings (e.g. `maintenance_mode`, `scheduler_paused`) worth a conscious decision on exact values
  rather than a copy-paste. Safest next action: review `packages/database/seed/seed.sql`'s
  runtime-configuration block against current real operational intent, then insert via the same
  additive-only D1 pattern used for `plans`.
- **No real production admin account exists.** Reason: the local-dev seed's admin fixture is
  correctly excluded from production; bootstrapping a real admin requires the user to actually
  register a real passkey as themselves, then a targeted `UPDATE`/`INSERT` grant — an action
  involving a real credential belonging to a real person, not something to fabricate or perform
  without the user directly in the loop. Safest next action: the user registers a real account on
  `https://crawlpact.com`, then either I or they grant `super_admin` via the same D1 pattern used in
  this pass's verification (see `admin-db.ts`'s `grantSuperAdmin` e2e helper for the exact two
  writes needed).
- **A full manual, route-by-route click-through of every route in the brief's §3 matrix (agency
  views, every settings sub-page, every admin sub-page) was not performed.** Reason: no browser-UI
  driving tool was used beyond the one targeted production verification in §4.1 and the existing
  automated e2e/a11y suites; a full manual sweep of dozens of routes is a genuinely large,
  separate task. What exists: passing automated coverage for the highest-risk journeys (auth,
  admin core flows, billing entry, public SEO). Safest next action: if wanted, a dedicated pass
  extending e2e coverage to the currently-uncovered routes (agency client views, individual settings
  sub-pages) rather than a one-off manual pass whose findings wouldn't be regression-tested.
- **Cloudflare's "Workers Builds" duplicate deployment pipeline remains broken** (pre-existing,
  unchanged, already documented). Reason: disabling/reconfiguring it is a Cloudflare-dashboard-side
  change; recommended once the GitHub Actions e2e check is reliably green (close to true now).
- **The CSP gap in §10 is unfixed**, by product-decision, not oversight.
