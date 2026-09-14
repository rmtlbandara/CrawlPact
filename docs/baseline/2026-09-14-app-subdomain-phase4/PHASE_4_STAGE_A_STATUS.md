# Phase 4 — Stage A Status (Production Live; Stabilization Health Gate Passed)

Status 2026-09-14 (updated after Production Stage A deployment and post-deploy stabilization
health gate). **Production Stage A is now live**, deployed commit
`d77ae4ecd57d11c844eef62f7d05e530de779bad`, Worker version
`4078cdd9-2639-4421-ae68-af8174d03b69`. See `PRODUCTION_CUTOVER_EVIDENCE.md` and
`OBSERVABILITY_EVIDENCE.md` for the complete evidence (PRODUCTION LIVE HTTP, WORKERS TELEMETRY,
SOURCE INSPECTION, AUTOMATED SMOKE, GITHUB ACTIONS classes, each marked explicitly). Preview
evidence below (predating the Production cutover) remains valid and is retained unchanged.

## Verdict

```
PRODUCTION STAGE A — STABILIZATION PASS ✅
STAGE B ELIGIBLE — NOT STARTED
```

Stage B has NOT started. Stage C has NOT started. Stage A redirects remain `307`. The WebAuthn
Stage C origin-narrowing restriction remains unchanged (any currently-trusted origin still
accepted). `workers.dev` remains in its temporary rollback-window state. BIC (Billing
Invariant Constraint) remains unchanged — no Paddle configuration was touched.

### Prior verdict (superseded, retained for history)

```
PHASE 4 STAGE A — PREVIEW VALIDATION PASS
BLOCKED — PHASE 4 FINALIZATION INCOMPLETE (Production Stage A not yet deployed)
```

Every gate this pass could actually run — including, now, full live two-origin Preview
validation (`PREVIEW_VALIDATION.md`, 21/21 checks) — is green. What remains before the full
Phase 4 directive's acceptance criteria are met: a real Production Stage-A deployment, a live
observability health-gate window, Stage B permanentization, and (separately) Stage C WebAuthn
finalization. Declaring `PASS — PHASE 4 CUTOVER COMPLETE` without those would be exactly the
"claim flawless merely because tests pass" the directive itself prohibits — Preview validation,
however thorough, is not Production validation.

## What this pass actually did (implementation + local/CI-track validation only)

1. **Extended the executable route-ownership contract** (`route-ownership.ts`):
   `isAppOnlyPagePath` (the three `APP_ONLY` page families) and `classifyApiOwnership` (every
   `/api/**` family, enumerated from the real file tree, zero `UNKNOWN` for any route that
   actually exists — enforced by a CI test that walks the real files, not merely asserted).
2. **Implemented symmetric wrong-host enforcement** in `worker.ts`: apex→app page redirect
   (Stage A, 307) for `/sign-in`/`/app/**`/`/admin/**`, and bidirectional `/api/*` wrong-host
   rejection (an `APP_ONLY` API 404s on the apex; a `PUBLIC_ONLY`/`SERVER_TO_SERVER_PUBLIC` API
   404s on the app host; the one `SHARED_SAME_ORIGIN_SURFACE` entry is exempt).
3. **Built `toAppUrl`/`requireAppOrigin`** (`origin.ts`) and `legacy-redirect.ts` (the redirect
   target + `/sign-in` query allowlist).
4. **Migrated the 5 real first-party PUBLIC→APP entry points** found by an exhaustive grep
   sweep (`SiteHeader.astro` ×2, `pricing.astro`, `PricingPlans.tsx`, `AuditConversionCta.tsx` +
   its two non-`/sign-in` targets) — see `ENTRY_POINT_INVENTORY.md`.
5. **Added a supersession note**, not a rewrite, to the historical Phase 1 route-ownership matrix
   resolving the `/app` de-prefixing question the directive itself flagged.
6. **Local quality gate, all green**: `pnpm format`/`format:check`, `pnpm lint` (0 warnings),
   `pnpm typecheck` (0 errors, 556 files), `pnpm test:unit` (729/729 — up from 681 before this
   pass), `pnpm test:security` (45/45), `pnpm db:validate` (56 tables), `pnpm build`.
7. **48 new/updated unit tests** across `route-ownership.test.ts`, `origin.test.ts`,
   `legacy-redirect.test.ts` (new), and `worker.host-boundary.test.ts` (including fixing the one
   stale pre-Phase-4 assertion, not silently leaving it wrong).

## What this pass explicitly did NOT do, and why

- **Superseded**: this pass has since pushed the branch, opened PR #180, gotten CI green,
  attached a second Preview Custom Domain (owner-approved), and completed full live Preview
  validation — see "RESOLVED 2026-09-14" below and `PREVIEW_VALIDATION.md` for the complete
  evidence.
- **Did not run the full `pnpm test:e2e` / `pnpm test:integration` suites to a clean local
  result.** Both suites hit this migration's long-documented, pre-existing local Miniflare/
  WebAuthn-hydration resource-contention flakiness (confirmed via two direct attempts at
  `pricing.spec.ts`/`audit-conversion.spec.ts`, both failing during shared-fixture _setup_, before
  reaching either spec's own test body — the identical signature documented across PRs #173–#179
  this migration). CI's isolated environment is this repository's own established authoritative
  check for these suites; it has not yet run against this branch.
- **Did not implement a `returnTo` deep-link mechanism** (directive §12). Decision, not an
  omission: building a new, redirect-loop-safe, centralized mechanism under this pass's time
  budget carries real risk of introducing exactly the open-redirect class of bug the directive
  itself warns against hardest, for a polish improvement (preserving a deep link through a forced
  reauthentication) the directive itself says to skip if the risk is disproportionate. The
  existing fallback — an unauthenticated deep link simply reaches `/sign-in` with no `returnTo`,
  landing the user at `/app` after authenticating — is safe, already shipped, and not a new
  regression. Documented here as required rather than silently dropped.
- **Did not touch WebAuthn ceremony origin restriction (Stage C)**, Google configuration, Paddle
  configuration, or the `workers.dev`/BIC decisions — all explicitly out of this pass's scope per
  the directive's own architecture freeze and the owner's standing 2026-09-11 authorization.
- **Did not deploy anything to Production, or flip Stage A's 307 to Stage B's 308.** Both require
  a real, observed Production health-gate window this pass cannot fabricate.

## Second real bug: independent review found a cross-origin asset regression CI never caught

An independent review of PR #180 (after CI was fully green) found a real defect neither this
session's own tests nor CI's E2E run exercised at all: **zero E2E coverage of agency branding
exists in this repository**, so the bug below was invisible to every automated check that had
run so far.

**Root cause**: `GET /api/agency-branding/logo/[...key]` is correctly classified `PUBLIC_ONLY`
(a shared/public report viewer must load the logo with no authentication) — this classification
is deliberate and was **not** weakened. But two `APP_ONLY` UI components —
`AgencyBrandingSettings.tsx` (`/app/agency-branding`) and `ShareReportDialog.tsx`
(`/app/domains/:domainId`, and conditionally `/audit/:auditId` for a legacy apex-scoped session)
— rendered the stored `logoUrl`/`logoPath` directly as `<img src={logoUrl}>`, a **relative** path.
Once the apex and app hosts are genuinely distinct origins, that relative URL resolves against
`app.crawlpact.com`, and this pass's own new wrong-host `/api/*` rejection (1b) correctly 404s a
`PUBLIC_ONLY` API reached on the app host — meaning the logo image would break in exactly the
environment (real cross-origin Production/Preview) this pass's own local/CI single-origin
regression fix (see below) could never exercise. Confirmed genuinely reachable in Production/
Preview terms, not merely theoretical: `AgencyBrandingSettings` is APP_ONLY-only (always broken
post-cutover), `ShareReportDialog` is reachable both from an APP_ONLY page (always broken
post-cutover) and, narrowly, from the PUBLIC `/audit/:auditId` page when a pre-cutover
apex-scoped session still exists (session-dependent, transitional).

**Fix — display only, storage/API contract unchanged**: added `toLogoDisplayUrl(publicOrigin,
logoUrl)` (`agency-logo.ts`) — a pure `${publicOrigin}${logoUrl}` transform used only at render
time for `<img src>`. `publicOrigin` is threaded from each server-rendered parent
(`getPublicOrigin()`) into the client island as a required prop — never guessed client-side.
Nothing about the stored/API `logoUrl` value, its validation (`logoPathBelongsToUser`,
`objectKeyFromLogoUrl`, `AGENCY_LOGO_PATH_PATTERN`), or the upload/profile POST/PUT payloads
changed — those remain the same relative path, same-origin-to-app, exactly as before. No route
ownership was weakened: the logo GET endpoint is still `PUBLIC_ONLY`, still rejected on the app
host, still served on the apex — `classifyApiOwnership` and its exhaustive real-file-tree test are
unchanged from PR #180's original commit.

**Repository-wide sweep performed** (not limited to agency branding, per the review's own
instruction): grepped every `PUBLIC_ONLY`/`SERVER_TO_SERVER_PUBLIC` API path
(`/api/audit`, `/api/audit/:id`, `/api/audit/:id/report`, `/api/audit/:id/continuation`,
`/api/agency-branding/logo/:key`, `/api/billing/webhook`) against every APP_ONLY UI file
(`components/app/**`, `components/admin/**`, `pages/app/**`, `pages/admin/**`) for `fetch`/`<img
src>`/background-image usage, and the inverse (every `APP_ONLY` API path against every PUBLIC
surface component/page). Result: the two agency-logo `<img>` cases above were the only real hits.
The two `/api/audit/*` references found in APP_ONLY components (`ShareReportDialog.tsx`'s
`/api/audit/:auditId/share`, `AuditConversionHandoff.tsx`'s `/api/audit/continuation/:id`) are
both correctly `APP_ONLY` themselves — same-origin-to-app, not a cross-origin issue.

**One further finding, documented rather than "fixed"**: `ShareReportDialog` can render on the
public `/audit/:auditId` page for a visitor with a still-live, pre-cutover, apex-scoped session
(host-only cookies mean this can only be a legacy session, never a newly-created one). In that
narrow case, its "Create link" action (`POST /api/audit/:auditId/share`, itself correctly
`APP_ONLY`) and its branding-profile prefill (`GET /api/agency-branding/profile`, also
`APP_ONLY`) will now correctly 404 when that fetch is made from the apex — because this pass's
own 1b enforcement is doing exactly its job: an `APP_ONLY`, credentialed, same-origin-only
endpoint must never respond to a same-origin-_apex_ request just because a legacy apex-scoped
session cookie happens to still be present. There is no safe fix for this beyond what Phase 4
already prescribes: same-origin-only APIs, no CORS, no credentialed cross-origin fetch (ADR-0010).
The correct resolution is the same one-time reauthentication the whole migration already accepts
— a user in this state gets a clear failure on this one action rather than a silent success, and
regains full functionality the next time they sign in (now necessarily on the app host). Recorded
here as an accepted, narrow, transitional limitation, not silently dropped.

**Regression tests added**: `agency-logo.test.ts` (`toLogoDisplayUrl` — 3 tests, including that
the stored path itself is untouched), `worker.host-boundary.test.ts` (3 new tests: the logo GET
endpoint still 404s on the app host, still 200s on the apex, and the upload POST endpoint at the
same path prefix still works on the app host — proving no route-ownership weakening).

## Real bug found and fixed by CI (not by local testing)

The first CI run on PR #180 failed with `net::ERR_TOO_MANY_REDIRECTS` during E2E setup, not the
usual local-flakiness signature. Root cause: local/CI's legitimate single-origin dev config
(`.env.example`'s `PUBLIC_APP_URL` set equal to `PUBLIC_SITE_URL`) makes `classifyOrigin` resolve
every request to `"public"` (the public-origin check runs first and matches), so the new
apex→app `/sign-in` redirect fired against a target identical to the request's own URL — an
infinite loop. The same condition would also have 404'd every `APP_ONLY` API in that
environment. Fixed by adding `hasDistinctAppOrigin()` (`origin.ts`) and gating both new Phase 4
checks in `worker.ts` on it — the checks now correctly no-op whenever there is no genuinely
distinct second origin configured, matching how `getTrustedOrigins()` already treats this case.
Five new regression tests cover this exact configuration directly. This is recorded here rather
than glossed over: local unit tests (all written against two distinct mocked origins) did not
catch it; CI, running against the real single-origin local/CI config, did — exactly the kind of
gap this migration's own established practice of never trusting local-only test results over CI
exists to catch.

## CI result (PR #180)

Final head: `777af0cc1ede81f9e48bc4fcfff6f4c7f2164e4c`. Green after the agency-branding
cross-origin-asset fix (see below) plus three E2E reruns on this exact commit — each failure had
a distinct, already-documented-elsewhere-in-this-migration flake signature (a WebAuthn
setup-fixture `page.waitForResponse` timeout; the "Worker code hung" 500 signature on an
unrelated `notifications-monitoring-reliability.spec.ts` spec; a tight-explicit-timeout real
audit/registration flow in `audit-conversion.spec.ts` under third-run CI-runner load) — none
touching agency branding or any file this fix changed. Final result:
`Format, lint, typecheck, unit + integration tests, build` and `Chromium E2E + accessibility
smoke` both pass — 152/152 E2E + accessibility tests on the clean run. `gh pr view 180` reports
`mergeStateStatus: CLEAN`, `mergeable: MERGEABLE`. **Not merged.**

## Preview deployment attempt found a genuine, pre-existing infrastructure gap

Deployed PR #180's exact final head (`efbadb8`) to Preview (`deploy-preview.yml`,
`commit_sha=efbadb8418288a2b7be434ce61a135f6cc7b41ec`). The deploy itself succeeded, but the
workflow's own pre-existing smoke test failed: `GET https://preview.crawlpact.com/sign-in`
returned `307` instead of `200`, because Stage A's apex→app redirect (working exactly as
designed and tested) sent it to `https://app.preview.crawlpact.com/sign-in` — **a hostname that
has never been attached as a real Cloudflare Custom Domain**. This is not a code defect: it is a
disclosed, pre-existing gap from Phase 1 of this migration (recorded in `STARTING_STATE.md`
before this deploy attempt, re-confirmed by `ORIGIN_AND_ROUTE_OWNERSHIP_MATRIX.md`'s own
Preview-hostname note) that Phase 4 is the first piece of work to actually depend on
behaviorally — every prior phase configured `PUBLIC_APP_URL` for Preview but never exercised a
code path that would redirect real Preview traffic there.

**Immediate action taken**: restored Preview to the last known-good deployment
(`ce953a4`, the pre-Phase-4 `main` tip — confirmed via `gh run list` as the most recent
`success`ful `deploy-preview.yml` run) via the same workflow. The first restoration attempt's own
CI smoke-test run also showed the stale `307`, traced to ordinary Cloudflare edge-propagation lag
(the smoke test ran ~5 seconds after `version.created_on`) rather than a second real failure —
confirmed by independently curling `https://preview.crawlpact.com/sign-in` directly moments
later (three separate checks, all `200`, with the expected `"Sign in with passkey"`/`"Create
account"` content present, and `/app` correctly `302`-ing to sign-in). **Preview is currently
healthy, running the pre-Phase-4 code.**

**This blocked genuine Preview validation of Stage A's redirect behavior specifically** — not the
unit-level proof (`legacy-redirect.test.ts`, `worker.host-boundary.test.ts`, 60+ tests, all
passing), which remained valid and unaffected, but the live, real-HTTP, two-host proof this
phase's own directive calls for. Per this session's standing principle (never bypass or weaken a
blocking harness/prerequisite to force a result through), the fix was **not** to special-case or
disable the redirect for Preview — that would have defeated the point of validating it at all.

## RESOLVED 2026-09-14: `app.preview.crawlpact.com` attached, Preview validation complete

The owner explicitly approved attaching `app.preview.crawlpact.com` as a second real Cloudflare
Custom Domain for `crawlpact-web-preview` — a Preview-only infrastructure change. Preflight
(live Cloudflare API read) confirmed clean: no conflicting DNS record, not attached elsewhere,
`preview.crawlpact.com` unaffected, Production untouched. `wrangler.jsonc`'s `env.preview.routes`
now declares both Custom Domains (source of truth, not the dashboard alone); 7 new tests
(`wrangler-preview-topology.test.ts`) guard this against drift. Deploying the exact PR head
(`a808f0f`) to Preview caused `wrangler deploy` to auto-provision the second Custom Domain
directly — no manual Cloudflare API call was needed — confirmed via a live API read showing both
hostnames attached with their own distinct, real TLS certificates.

This deployment attempt found one more real, CI-invisible defect (`scripts/smoke-test.ts`
hardcoded `/sign-in` returning 200 directly on the base URL — stale the moment a real distinct
app host exists): fixed with an optional `appBaseUrl` third argument, `smoke:preview` updated to
pass it, `smoke:production` deliberately left unchanged (Production hasn't cut over yet). Verified
directly: `smoke:preview` 39/39, `smoke:production` 35/35 (unaffected).

**The full 21-point live two-origin validation matrix passes — see `PREVIEW_VALIDATION.md` for
the complete evidence**, including: apex→app redirects (`/sign-in`, `/app`, `/admin`) with query
allowlisting and full-path preservation, one hop with no loop, bidirectional wrong-host `/api/*`
rejection (proven via distinguishably different response bodies, not just matching status codes),
the agency-logo fix confirmed live (the real handler is reached on the correct host, rejected on
the wrong one), the Static Assets alias boundary holding on the real two-host topology, app-host
noindex and GA/Clarity absence, and Workers Logs receiving clean (zero 5xx, zero exceptions)
telemetry from both real hostnames.

## Hard gates: current status

| Gate                                                              | Status                                                                                                                       |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Route ownership contract, zero UNRESOLVED                         | ✅ (CI-enforced test)                                                                                                        |
| Symmetric wrong-host enforcement (page + API, both directions)    | ✅ (48 new unit tests, all green locally; reconfirmed live in Production, see `PRODUCTION_CUTOVER_EVIDENCE.md` §4)           |
| No `/app` de-prefixing                                            | ✅ (explicit test + doc supersession note)                                                                                   |
| First-party entry points migrated                                 | ✅ (5/5 found, all migrated; confirmed live in Production, see `PRODUCTION_CUTOVER_EVIDENCE.md` §10)                         |
| Redirect: one hop, no loop, method-safe                           | ✅ (unit-tested directly; reconfirmed live in Production)                                                                    |
| Local quality gate (format/lint/typecheck/unit/security/db/build) | ✅ all green                                                                                                                 |
| Full E2E/integration suite clean                                  | ✅ CI green (151/151 E2E+a11y), first-attempt-clean on final commit; local run still blocked by known pre-existing flakiness |
| Preview deployment + validation                                   | ✅ PASS — both Custom Domains live, full 21-point matrix green (`PREVIEW_VALIDATION.md`)                                     |
| Dedicated Phase 4 PR, CI green on exact head                      | ✅ PR #180 (merged), plus the smoke-readiness PR #190 (merged, `d77ae4e`)                                                    |
| Production Stage A deployment                                     | ✅ **live** — commit `d77ae4e`, Worker version `4078cdd9-...`, `PRODUCTION_CUTOVER_EVIDENCE.md`                              |
| Production observability health gate                              | ✅ **PASS** — ~30 min post-deploy window, zero 5xx, zero exceptions, `OBSERVABILITY_EVIDENCE.md`                             |
| Stage B permanentization (307→308)                                | ⏳ not started — eligible, owner decision required                                                                           |
| Stage C WebAuthn finalization                                     | ⏳ deferred — separate, later stage by design, not started                                                                   |

## Production deploy-time smoke anomaly (documented, not dismissed)

The `Deploy production` workflow's own smoke step ran ~6 seconds after the Worker version was
created and reported 2 failures (`/app` redirect target, `APP_ONLY` API wrong-host rejection)
consistent with ordinary Cloudflare edge-propagation lag immediately post-deploy — the same class
of false negative this migration already documented once before on Preview's own cutover.
Independently re-verified by this session via direct live HTTP checks and a fresh
`pnpm run smoke:production` run: **43/43 passed**. The workflow run's historical conclusion
remains `failure` — not relabeled. See `PRODUCTION_CUTOVER_EVIDENCE.md` §2 for full detail and the
required classification wording.

## Stage-B-readiness hardening recommendation (documented only — NOT implemented this pass)

The Production deployment workflow's first smoke assertion runs immediately after `wrangler
deploy` with no delay, which is what produced the propagation-lag false negative above. Before
Stage B (permanent 308s, harder to reverse) is considered, `deploy-production.yml`'s smoke step
should be hardened against this exact recurrence. Recommended design (either is acceptable, not
mutually required):

- **Bounded initial delay + smoke**: sleep a short, fixed duration (e.g. 10–15s) after the deploy
  step, before running `pnpm run smoke:production` once, as today.
- **Bounded smoke retry with short backoff**: run the existing smoke script; on failure, wait a
  short backoff and retry the same read-only checks, up to a small fixed attempt count (e.g. 3),
  logging every attempt's result.

Hard requirements for whichever is chosen: never turn a persistent failure into a reported
success; retry/delay only the existing read-only smoke checks, never redeploy between attempts;
bounded attempts (no unbounded retry loop); the final persistent failure must still fail the
deployment workflow exactly as it does today; every attempt must be logged.

**Not implemented in this pass** — this pass is a stabilization health gate, not a workflow
change, and the directive explicitly scoped this as "do not implement until Stage A's health gate
is closed unless required to safely proceed." It was not required to safely proceed: the anomaly
was fully explained by independent live re-verification, and Production is confirmed healthy
without this hardening in place.

## Final verdict

```
PRODUCTION STAGE A — STABILIZATION PASS ✅
STAGE B ELIGIBLE — NOT STARTED
```

Production Stage A is live (`d77ae4e`, Worker version `4078cdd9-...`), independently verified
healthy across the full route/API/asset/search/analytics/auth/billing/telemetry matrix — see
`PRODUCTION_CUTOVER_EVIDENCE.md` and `OBSERVABILITY_EVIDENCE.md`. **Stage B has NOT started.
Stage C has NOT started. Stage A redirects remain 307. The WebAuthn Stage C restriction remains
unchanged. `workers.dev` remains in its temporary rollback-window state. BIC remains unchanged.**
