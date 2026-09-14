# Phase 4 — Stage A Status (Candidate, Not Yet Deployed Anywhere)

Status 2026-09-14. This document exists specifically so nothing in this pass's other evidence
files is misread as claiming more than what actually happened. **Nothing in this document has
been deployed to Preview or Production.** All evidence below is SOURCE INSPECTION, AUTOMATED
TEST (local), or CI, never PREVIEW LIVE or PRODUCTION LIVE HTTP.

## Verdict

```
BLOCKED — PHASE 4 FINALIZATION INCOMPLETE
```

Not because a hard gate failed — every gate this pass could actually run is green (see below) —
but because the Phase 4 directive's full acceptance criteria require Preview deployment, a
dedicated PR, CI on the exact PR head, a real Production Stage-A deployment, a live observability
health-gate window, Stage B permanentization, and (separately) Stage C WebAuthn finalization —
none of which this pass performed. Declaring `PASS — PHASE 4 CUTOVER COMPLETE` without those would
be exactly the "claim flawless merely because tests pass" the directive itself prohibits.

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

- **Did not create a branch push / PR / Preview deployment yet.** The code above exists only in
  this local working tree at the time this document was written; see the accompanying session
  report for whether it has since been pushed.
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

## Hard gates: current status

| Gate                                                              | Status                                                                       |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Route ownership contract, zero UNRESOLVED                         | ✅ (CI-enforced test)                                                        |
| Symmetric wrong-host enforcement (page + API, both directions)    | ✅ (48 new unit tests, all green locally)                                    |
| No `/app` de-prefixing                                            | ✅ (explicit test + doc supersession note)                                   |
| First-party entry points migrated                                 | ✅ (5/5 found, all migrated)                                                 |
| Redirect: one hop, no loop, method-safe                           | ✅ (unit-tested directly)                                                    |
| Local quality gate (format/lint/typecheck/unit/security/db/build) | ✅ all green                                                                 |
| Full E2E/integration suite clean                                  | ⏳ not yet run to a clean result locally (known local flakiness); CI pending |
| Preview deployment + validation                                   | ⏳ not started                                                               |
| Dedicated Phase 4 PR, CI green on exact head                      | ⏳ not started                                                               |
| Production Stage A deployment                                     | ⏳ not started — requires fresh, explicit, in-the-moment owner permission    |
| Production observability health gate                              | ⏳ not started                                                               |
| Stage B permanentization (307→308)                                | ⏳ not started — gated on the above                                          |
| Stage C WebAuthn finalization                                     | ⏳ deferred — separate, later stage by design                                |

## Final verdict (restated)

```
BLOCKED — PHASE 4 FINALIZATION INCOMPLETE
```

Blocker: this is a Stage-A implementation candidate, locally/CI-track validated, not yet pushed,
reviewed, Preview-deployed, or Production-deployed. **Phase 4 has NOT started in Production.**
