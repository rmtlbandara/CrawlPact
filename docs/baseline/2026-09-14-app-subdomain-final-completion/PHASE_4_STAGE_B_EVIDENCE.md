# Phase 4 Stage B — Permanent Redirect Evidence

Status 2026-09-15. Stage B (`LEGACY_REDIRECT_STATUS` 307 → 308) is now live in Production.
Evidence class marked per claim.

## 1. Deployment facts (GITHUB ACTIONS + CLOUDFLARE API)

- PR #193, narrow code change only (`legacy-redirect.ts`'s single constant, plus the tests that
  assert its exact value). Merged as `58da28e410b2608aa64c6a6ad75814b032c83de1`.
- `main` CI on that exact SHA: success. Post-merge Preview auto-deploy: success.
- Exact PR head (`14ce9c4459e31b9e3907958a04970145c5581705`) deployed to Preview **before merge**
  and live-validated (see §2) — not merged first and validated after.
- Production deployment workflow: `Deploy production`, run
  [`34922290155`](https://github.com/rmtlbandara/CrawlPact/actions/runs/34922290155), dispatched
  by the owner directly (this session's own dispatch attempts were consistently refused by the
  harness's own safety classifier for this specific action — reported transparently rather than
  bypassed, per standing practice). Conclusion: **success** (the Phase 3.1 propagation-retry
  hardening meant no false-negative smoke failure occurred this time, unlike Stage A's own
  deployment).
- Deployed Worker version: `226f5ce7-d5e8-4856-9c18-6d43d2264e0f`, confirmed **live at 100%** via
  `GET /accounts/{account}/workers/scripts/crawlpact-web/deployments`.

## 2. Preview live validation (exact PR head, before merge) — PREVIEW LIVE HTTP

| Check                                                                                     | Result                                                                    |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `/sign-in`                                                                                | `308` → `https://app.preview.crawlpact.com/sign-in`                       |
| `/app`                                                                                    | `308` → `https://app.preview.crawlpact.com/app`                           |
| `/app/domains/abc` (nested)                                                               | `308` → exact path preserved                                              |
| `/admin`                                                                                  | `308` → `https://app.preview.crawlpact.com/admin`                         |
| `/admin/users/abc` (nested)                                                               | `308` → exact path preserved                                              |
| Complete Preview smoke suite                                                              | 39/39 passed                                                              |
| Static Assets alias boundary (`/pricing`, `/pricing/`, `/pricing/index.html` on app host) | all `308`/`404`, never render public HTML directly — no bypass reappeared |

## 3. Production live validation (post-deploy) — PRODUCTION LIVE HTTP

| Check                                                        | Result                                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `/sign-in`                                                   | `308` → `https://app.crawlpact.com/sign-in`                                     |
| `/app`                                                       | `308` → `https://app.crawlpact.com/app`                                         |
| `/app/domains/abc` (nested)                                  | `308` → exact path preserved                                                    |
| `/admin`                                                     | `308` → `https://app.crawlpact.com/admin`                                       |
| `/admin/users/abc` (nested)                                  | `308` → exact path preserved                                                    |
| One-hop confirmation (`app.crawlpact.com/sign-in`)           | `200` directly, no further redirect                                             |
| No chain (`app.crawlpact.com/app`, `/admin` unauthenticated) | `302` to the app host's own `/sign-in` — never bounces back to the apex         |
| APP_ONLY API (`/api/domains`) on apex                        | `404`                                                                           |
| PUBLIC_ONLY API (`POST /api/audit`) on app host              | `404`                                                                           |
| Public pages (`/`, `/pricing/`, `/status/`)                  | `200`, unaffected                                                               |
| App pages (`/`, `/sign-in` on app host)                      | `200`, unaffected                                                               |
| Sitemap                                                      | zero `app.crawlpact.com`, zero `preview.crawlpact.com`, zero `workers.dev` URLs |
| App host noindex                                             | `noindex` present on `/sign-in`                                                 |
| Full `pnpm run smoke:production`                             | **43/43 passed**                                                                |

## 4. Observation window (WORKERS TELEMETRY)

Full ~30-minute post-deploy window, `2026-09-15T02:50:06Z`–`03:20:30Z`, aggregate Cloudflare
GraphQL Analytics only:

| Metric                                            | Result                                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Worker invocations (`workersInvocationsAdaptive`) | 64 requests, **0 errors**, `success` status only                                   |
| Zone-wide 5xx (`edgeResponseStatus_geq: 500`)     | **zero rows**                                                                      |
| `308` count on `crawlpact.com`                    | 15 — consistent with this session's own live validation checks, no runaway pattern |
| `app.crawlpact.com` status breakdown              | 200 ×6, 302 ×4 (app-host auth-gate, own `/sign-in`), 404 ×3                        |
| `crawlpact.com` status breakdown                  | 200 ×22, 301 ×4 (canonical/www), 400 ×3, 404 ×6, 308 ×15                           |

No material 5xx or exception spike, no redirect-loop signature, no host-boundary bypass. (The
`e2e-fixture.crawlpact.com` rows in the same query are unrelated background scanner-test traffic,
not app/apex hosts.)

## 5. Scope discipline

No routing/ownership logic changed beyond the single `LEGACY_REDIRECT_STATUS` constant. No
WebAuthn/CSRF/session/Paddle/Cloudflare-config change. No database migration. Stage C's PR (#194)
was opened during this same session but is a separate, independently-validated deployment — not
bundled into this one.

## Gate

```
PHASE 4 STAGE B — PERMANENTIZATION PASS ✅
```
