# Phase 4 Stage A — Production Cutover Evidence

Status 2026-09-14. Production Stage A is now live. This document records the deployment itself,
the deploy-time smoke anomaly (explained, not dismissed), and the post-deploy stabilization
health-gate evidence gathered directly against live Production. Evidence class is marked
explicitly on every claim per the health-gate directive's own requirement.

## 1. Deployment facts (GITHUB ACTIONS + CLOUDFLARE API)

- Deployed commit: `d77ae4ecd57d11c844eef62f7d05e530de779bad` (`main`)
- Deployment workflow: `Deploy production`, run
  [`34835290020`](https://github.com/rmtlbandara/CrawlPact/actions/runs/34835290020)
- Deployed Worker version: `4078cdd9-2639-4421-ae68-af8174d03b69` (version 86), created
  `2026-09-14T10:59:44Z` — confirmed via `GET
/accounts/{account}/workers/scripts/crawlpact-web/versions`
- Confirmed **live at 100%** via `GET
/accounts/{account}/workers/scripts/crawlpact-web/deployments`
  (deployment `d395128d-3908-4f9e-8680-d889d1f3b234`, `versions: [{version_id:
"4078cdd9-...", percentage: 100}]`, `created_on: 2026-09-14T10:59:45Z`) — this is not merely
  "uploaded," it is the sole version serving 100% of live traffic.
- Workflow steps: every step through `Deploy production Worker` and `Verify deployed bindings
match wrangler.jsonc` succeeded. Only `Smoke test production` failed. Workflow conclusion is
  historically **`failure`** — not relabeled.

## 2. The deploy-time smoke anomaly (GITHUB ACTIONS, independently re-verified)

The workflow's smoke step ran at `2026-09-14T10:59:51Z` — approximately **6 seconds** after the
Worker version was created (`10:59:45Z`). It reported 41/43 checks passed, with exactly two
failures:

- `/app (apex -> app host): redirects to https://app.crawlpact.com/app` — got `/sign-in`
  (pre-cutover 302 behavior)
- `APP_ONLY API rejected on the apex (wrong host)` — got `401` (pre-cutover behavior; the old
  code path reached the real handler, which itself returned 401 for lack of a session)

Both failures are consistent with a **stale edge cache/propagation lag** immediately after
deploy, not a routing defect — the exact same class of false negative this migration already
documented and confirmed once before, during Preview's own Stage A cutover
(`PHASE_4_STAGE_A_STATUS.md`, "ordinary Cloudflare edge-propagation lag").

**This session's own independent re-verification**, run directly against live Production between
`2026-09-14T11:17Z` and `11:19Z` (roughly 18 minutes after propagation settled):

- PRODUCTION LIVE HTTP: `curl https://crawlpact.com/app` → `307` → `https://app.crawlpact.com/app`
- PRODUCTION LIVE HTTP: `curl https://crawlpact.com/api/domains` → `404`
- AUTOMATED SMOKE: `pnpm run smoke:production` run directly by this session (not the workflow) →
  **43/43 checks passed**

**Classification, per the health-gate directive's own required wording:**

```
DEPLOY SUCCEEDED — INITIAL POST-DEPLOY SMOKE FALSE NEGATIVE CONSISTENT WITH EDGE PROPAGATION
```

The workflow run's historical conclusion remains `failure` and is not rewritten as `success`. The
deployment itself is valid because the subsequently observed live Worker behavior matches the
exact deployed Stage-A contract, confirmed by two independent methods (direct HTTP, and a full
local run of the same smoke suite the workflow uses).

## 3. Safe Production route matrix (PRODUCTION LIVE HTTP)

All checks below were run directly against `https://crawlpact.com` and
`https://app.crawlpact.com` by this session, using GET/HEAD only, after the deploy.

### Public apex — normal behavior, no unexpected app-host redirect, no 5xx

| Path                                                                       | Result |
| -------------------------------------------------------------------------- | ------ |
| `/`                                                                        | 200    |
| `/pricing/`                                                                | 200    |
| `/audit/`                                                                  | 200    |
| `/status/`                                                                 | 200    |
| `/robots.txt`                                                              | 200    |
| `/sitemap.xml`                                                             | 200    |
| `/.well-known/security.txt`                                                | 200    |
| `/pay`                                                                     | 200    |
| `/guides/amazonbot-vs-amzn-searchbot-vs-amzn-user/` (representative guide) | 200    |
| `/platforms/cloudflare/` (representative platform)                         | 200    |
| `/crawlers/perplexitybot/` (representative crawler)                        | 200    |
| `/for/agencies/` (representative `/for/*`)                                 | 200    |

### Legacy APP_ONLY pages on apex — 307, direct app-host target, one hop, allowlist respected

| Path                                | Result                                                          |
| ----------------------------------- | --------------------------------------------------------------- |
| `/sign-in`                          | 307 → `https://app.crawlpact.com/sign-in`                       |
| `/sign-in?plan=pro&interval=year`   | 307 → same path+query preserved                                 |
| `/sign-in?continuation=<synthetic>` | 307 → `continuation` preserved                                  |
| `/sign-in?unsupported=xyz`          | 307 → target has `unsupported` **dropped** (allowlist enforced) |
| `/app`                              | 307 → `https://app.crawlpact.com/app` (prefix preserved)        |
| `/app/account`                      | 307 → `https://app.crawlpact.com/app/account`                   |
| `/app/billing`                      | 307 → `https://app.crawlpact.com/app/billing`                   |
| `/app/domains`                      | 307 → `https://app.crawlpact.com/app/domains`                   |
| `/admin`                            | 307 → `https://app.crawlpact.com/admin`                         |
| `/admin/users`                      | 307 → `https://app.crawlpact.com/admin/users`                   |

One-hop confirmation: `https://app.crawlpact.com/sign-in` itself returns `200` directly (no
further redirect) — no loop.

### App host — boundary intact, unauthenticated behavior correct

| Path                                                     | Result                                                                                                                       |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                      | 200 (app shell, `<title>CrawlPact — AI crawler policy, verified.</title>` — not duplicate marketing copy; `noindex` present) |
| `/sign-in`                                               | 200, `noindex` present                                                                                                       |
| `/app`, `/app/account`, `/app/domains` (unauthenticated) | 302 → app host's own `/sign-in` (never bounces back to the apex)                                                             |
| `/admin` (unauthenticated)                               | 302 → app host's own `/sign-in`                                                                                              |
| `/robots.txt`                                            | 200                                                                                                                          |

## 4. API ownership matrix (PRODUCTION LIVE HTTP, safe requests only)

| Check                                                               | Result                                             |
| ------------------------------------------------------------------- | -------------------------------------------------- |
| APP_ONLY API (`/api/domains`) on apex                               | **404**                                            |
| PUBLIC_ONLY API (`POST /api/audit`) on app host                     | **404**                                            |
| SERVER_TO_SERVER_PUBLIC (`POST /api/billing/webhook`) on app host   | **404** (not functional)                           |
| SHARED (`POST /api/analytics/track`) on apex                        | 400 (reachable, malformed body — contract-correct) |
| SHARED (`POST /api/analytics/track`) on app host                    | 400 (same contract both sides)                     |
| Public API (`POST /api/billing/webhook`, invalid signature) on apex | 400 (still functional)                             |
| App API (`GET /api/domains`) on app host, unauthenticated           | 401 (reachable, auth-gated — not 404)              |
| INTERNAL_ONLY (`/api/test-only/*`) on apex                          | 404                                                |
| INTERNAL_ONLY (`/api/test-only/*`) on app host                      | 404                                                |

No API ownership was changed to make any check pass. No CORS header was introduced (not probed
for directly, but no code touched in this cutover adds one — see `git diff` scope in §7).

## 5. Static Assets alias boundary (PRODUCTION LIVE HTTP)

| Path (apex)                                              | Result                 |
| -------------------------------------------------------- | ---------------------- |
| `/pricing`                                               | 301 → `/pricing/`      |
| `/pricing/`                                              | 200                    |
| `/pricing/index`, `/pricing/index.html`, `/pricing.html` | 404 (no bypass)        |
| `/for/agencies`                                          | 301 → `/for/agencies/` |
| `/for/agencies/`                                         | 200                    |
| `/research`                                              | 200                    |

| Same aliases on app host | Result                                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `/pricing`, `/pricing/`  | 308 → `https://crawlpact.com/pricing/` (redirects to canonical public apex; never renders public HTML directly) |
| `/pricing/index.html`    | 404                                                                                                             |
| `/for/agencies/`         | 308 → `https://crawlpact.com/for/agencies/`                                                                     |

No Static Assets bypass has reappeared.

## 6. Search/indexability (PRODUCTION LIVE HTTP)

- Live `sitemap.xml`: **zero** `app.crawlpact.com` URLs, **zero** `preview.crawlpact.com` URLs,
  **zero** `workers.dev` URLs.
- Apex homepage/`pricing/` canonical tags both point at their own apex canonical URL.
- Apex homepage carries no `noindex`.
- App host `/` and `/sign-in` both carry `noindex`.

## 7. Analytics/privacy boundary (PRODUCTION LIVE HTTP)

Cookie-less fetches (no consent cookie sent) to apex `/` and to app-host `/sign-in`, `/app`,
`/admin`: **zero** occurrences of `googletagmanager.com` or `clarity.ms` in any response body.
(`/app` and `/admin` responses inspected are the 302's own body; substantive-content GA/Clarity
absence for those pages is proven by the `/sign-in` check they redirect to, which was checked
directly.) No parent-domain analytics cookie was treated as evidence of script execution — only
response-body script-tag presence was checked.

## 8. Auth/security health (SOURCE INSPECTION + AUTOMATED TEST + PRODUCTION LIVE HTTP)

- `WEBAUTHN_RP_ID` in `wrangler.jsonc`'s production config: **`crawlpact.com`** — unchanged.
- `requireCeremonyOrigin` (`lib/auth/webauthn.ts`) still accepts **any** currently-trusted origin
  via `getValidatedRequestOrigin`/`getTrustedOrigins` — not narrowed to the app origin. Stage C
  has not started.
- `apps/web/src/lib/auth/webauthn.test.ts` re-run directly this session: **9/9 passed**,
  including the case proving a ceremony still succeeds at the public origin — itself the
  Stage-C-not-introduced proof, per this migration's established convention.
- `assertSameOrigin` (`lib/auth/same-origin.ts`, CSRF defence-in-depth) inspected: unchanged by
  this cutover, still self-referential (expected origin is whichever trusted origin the request
  itself arrived on, never a fixed value, never "any trusted origin unconditionally").
- Admin routes (`/admin`, `/admin/**`) unauthenticated on the app host: 302 to the app host's own
  `/sign-in` — ordinary-session admin denial infrastructure unaffected (same session/role check
  as before, only the front-door host changed).
- `git diff e75c0d8..d77ae4e` (the exact range this session's own PR added on top of the
  already-merged Stage A code) touched only `package.json`, `scripts/smoke-test.ts`, and a new
  test file — no routing, auth, session, or CSRF logic changed in this session's own work.

## 9. Billing health (PRODUCTION LIVE HTTP)

- `/pay` (no `_ptxn`): 200, "Complete your payment" present.
- `POST /api/billing/webhook` with no valid signature (apex): 400 — rejected as expected.
- No Paddle configuration was touched in this cutover.
- No automatic checkout/subscription mutation occurred — no financial transaction was initiated
  by any check in this health gate.

## 10. Continuation entry-point health (SOURCE INSPECTION + PRODUCTION LIVE HTTP)

- `PricingPlans.tsx`: unauthenticated CTA constructs
  `${appOrigin}/sign-in?plan=${plan.id}&interval=${interval}` — confirmed live: apex
  `/sign-in?plan=pro&interval=year` redirects with both params preserved.
- `AuditConversionCta.tsx`: unauthenticated CTA constructs
  `${appOrigin}/sign-in?continuation=${encodeURIComponent(...)}` — confirmed live: the
  `continuation` query key survives the apex→app redirect unmodified; arbitrary unsupported keys
  do not.
- No real user continuation was consumed or mutated — only a synthetic value was used in the
  live redirect-target check.

## 11. Workers telemetry (WORKERS TELEMETRY, aggregate GraphQL Analytics API only)

See `OBSERVABILITY_EVIDENCE.md` for the full aggregate query results and the health-gate
acceptance determination.

## 12. Scope discipline

No runtime routing/ownership logic, WebAuthn config, CSRF logic, session/cookie logic, Paddle
configuration, or global Cloudflare security setting was changed by this session as part of this
health-gate task itself — every action taken here was either a read-only live check, a read-only
Cloudflare/GitHub API query, or a documentation update. Stage B (307→308) was not started. Stage
C (WebAuthn origin narrowing) was not started.
