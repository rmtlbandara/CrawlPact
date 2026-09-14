# Phase 4 — Final Route Ownership Matrix

Status 2026-09-14. Executable form: `apps/web/src/lib/route-ownership.ts`
(`isAppOnlyPagePath`, `classifyApiOwnership`) and `apps/web/src/worker.ts`'s host-boundary
enforcement. Enumerated directly from the real file tree under `apps/web/src/pages/`
(SOURCE INSPECTION), not copied from the Phase 1 matrix without re-checking — a matrix can drift
from the route tree over time, and one already had (see the `/app` de-prefixing note below).

Zero `UNRESOLVED` entries: `route-ownership.test.ts`'s
`"classifies every real API route file with a real ownership, never UNKNOWN"` test walks the
actual `apps/web/src/pages/api/**` file tree and asserts every real route file classifies as
something other than `"UNKNOWN"` — this is enforced by CI, not merely asserted in prose here.

## Page routes

| Route family                                                                                                                                                                 | Owner host          | Wrong-host behavior (GET/HEAD)                                                          | Wrong-host behavior (other methods) | Indexability             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------ |
| `/` and all `PUBLIC_ONLY` pages (marketing, `/audit`, `/pricing`, `/shared/*`, `/feed/*`, etc. — full list: `route-registry.ts` + `route-ownership.ts`'s `isPublicOnlyPath`) | `crawlpact.com`     | App host: 308 redirect to canonical apex URL (unchanged, Phase 2)                       | App host: 404 (unchanged, Phase 2)  | Indexable where designed |
| `/sign-in`                                                                                                                                                                   | `app.crawlpact.com` | Apex: 307 redirect to app host, allowlisted query only                                  | Apex: 404                           | `noindex`                |
| `/app`, `/app/**`                                                                                                                                                            | `app.crawlpact.com` | Apex: 307 redirect to app host, full path + query preserved, **no `/app` de-prefixing** | Apex: 404                           | `noindex`                |
| `/admin`, `/admin/**`                                                                                                                                                        | `app.crawlpact.com` | Apex: 307 redirect to app host, full path + query preserved                             | Apex: 404                           | `noindex`                |

**`/app` de-prefixing decision (Phase 4 directive §3)**: explicitly **not** implemented.
`app.crawlpact.com/app/**` is the final, shipped URL structure — see
`ORIGIN_AND_ROUTE_OWNERSHIP_MATRIX.md`'s new supersession note for why the historical Phase 1
LEGACY_REDIRECT table's de-prefixed suggestion is superseded, not followed.

**Redirect status (two-stage cutover)**: `LEGACY_REDIRECT_STATUS` in `legacy-redirect.ts` is
currently `307` (Stage A — reversible, uncacheable-as-permanent). Flips to `308` only after a real
Production health-gate window passes (Stage B) — not performed by this pass; see
`PHASE_4_STAGE_A_STATUS.md`.

## API routes (`classifyApiOwnership`)

| Path                                                                              | Ownership                    | Notes                                                                                                                      |
| --------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `/api/audit` (POST)                                                               | `PUBLIC_ONLY`                | Create anonymous audit                                                                                                     |
| `/api/audit/:auditId` (GET)                                                       | `PUBLIC_ONLY`                | Poll progress                                                                                                              |
| `/api/audit/:auditId/report` (GET)                                                | `PUBLIC_ONLY`                | Fetch completed report                                                                                                     |
| `/api/audit/:auditId/continuation` (POST)                                         | `PUBLIC_ONLY`                | Create continuation (pre-signup step)                                                                                      |
| `/api/audit/:auditId/share` (POST)                                                | `APP_ONLY`                   | Dashboard action on an owned audit — the one exception inside `/api/audit/*`                                               |
| `/api/audit/continuation/:continuationId` (POST)                                  | `APP_ONLY`                   | Consume, post-sign-in — a distinct top-level path, not nested under `:auditId`                                             |
| `/api/agency-branding/logo/:key` (GET)                                            | `PUBLIC_ONLY`                | Public asset read                                                                                                          |
| `/api/agency-branding/logo` (POST)                                                | `APP_ONLY`                   | Upload — same directory, different depth from the public read above                                                        |
| `/api/agency-branding/profile`                                                    | `APP_ONLY`                   |                                                                                                                            |
| `/api/analytics/track`                                                            | `SHARED_SAME_ORIGIN_SURFACE` | The one deliberately dual-host entry — callable same-origin from either host                                               |
| `/api/billing/webhook` (POST)                                                     | `SERVER_TO_SERVER_PUBLIC`    | Paddle webhook — apex-only, now enforced (previously convention-only)                                                      |
| `/api/billing/**` (everything else)                                               | `APP_ONLY`                   | checkout, portal-session, plan-change/*                                                                                    |
| `/api/auth/**`                                                                    | `APP_ONLY`                   | All ceremonies and session management                                                                                      |
| `/api/account/**`                                                                 | `APP_ONLY`                   |                                                                                                                            |
| `/api/domains/**`, `/api/groups/**`, `/api/workspace/**`, `/api/notifications/**` | `APP_ONLY`                   | Dashboard data APIs (feed-token _mint/revoke_ — consumption is the separate `PUBLIC_ONLY` page route `/feed/:token.xml`)   |
| `/api/app/**` (`pilot/feedback`)                                                  | `APP_ONLY`                   |                                                                                                                            |
| `/api/admin/**`                                                                   | `APP_ONLY`                   | ~55 endpoints, uniformly classified by prefix                                                                              |
| `/api/test-only/**`                                                               | `INTERNAL_ONLY`              | Already fails closed via `PUBLIC_APP_ENV === "local"` env-gate — worker-level host check intentionally not duplicated here |

**Wrong-host API enforcement (new, Phase 4)**: `worker.ts`'s host boundary now rejects (404) an
`APP_ONLY` API reached on the apex, and a `PUBLIC_ONLY`/`SERVER_TO_SERVER_PUBLIC` API reached on
the app host — for every method, not only mutations, since same-origin ownership is the final
architecture, not a migration-era GET exception. `SHARED_SAME_ORIGIN_SURFACE` and `UNKNOWN` (empty
in practice — see above) are exempt by design.

## Unknown/`workers.dev` host

Unchanged from Phase 2/3: an unrecognized Host + `isSensitivePath` (`/admin`, `/api/`, `/app`,
`/sign-in`) fails closed (404). Per the owner's explicit 2026-09-11 authorization,
`workers.dev` remains enabled through the Phase 4 rollback window — not revisited by this pass.
