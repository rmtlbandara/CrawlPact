# Phase 4 Stage C — WebAuthn Ceremony Origin Narrowing Evidence

Status 2026-09-15. Stage C (WebAuthn ceremonies restricted to the app origin once a distinct app
origin exists) is now live in Production. Evidence class marked per claim.

## 1. Deployment facts (GITHUB ACTIONS + CLOUDFLARE API)

- PR #194: `webauthn.ts`'s new `webauthnCeremonyOrigins()`/`isWebauthnCeremonyOrigin()` rule, plus
  the CSRF integration test fixture fix it required. Merged as
  `d8475d4c34da78c8acf6f81eecb21e59ead5c90f`.
- `main` CI on that exact SHA: success (one unrelated `saved-domain-timeline.spec.ts` E2E flake on
  the first attempt — the quality/unit/integration job, which directly exercises the WebAuthn
  code, passed clean on the first attempt; rerun of the E2E job passed clean too). Post-merge
  Preview auto-deploy: success.
- Exact PR head (`f837363f6c95457a9eb6d5f1dcc23d8920e1b8e4`) deployed to Preview **before merge**
  and live-validated (see §2).
- Production deployment workflow: `Deploy production`, run
  [`34929784371`](https://github.com/rmtlbandara/CrawlPact/actions/runs/34929784371), dispatched
  by the owner directly (this session's own dispatch attempts for this specific action were
  refused by the harness's own safety classifier, consistent with the same pattern seen on Stage
  B — reported transparently and handed to the owner rather than bypassed). Conclusion:
  **success**.
- Deployed Worker version: `bec609e0-afbe-4c16-90b9-b70e21ef9c60`, confirmed **live at 100%** via
  `GET /accounts/{account}/workers/scripts/crawlpact-web/deployments`.

## 2. Preview live validation (exact PR head, before merge) — PREVIEW LIVE HTTP

| Check                                             | Result                                                                                                                                                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/auth/register/begin` on app Preview    | `200`                                                                                                                                                                                                                                |
| `POST /api/auth/login/begin` on app Preview       | `200`                                                                                                                                                                                                                                |
| `POST /api/auth/register/begin` on public Preview | `404` (host-boundary, `/api/auth/**` is `APP_ONLY`)                                                                                                                                                                                  |
| `POST /api/auth/login/begin` on public Preview    | `404`                                                                                                                                                                                                                                |
| RP ID in the app-host response                    | exactly `preview.crawlpact.com` — Preview's own valid parent-domain value, unchanged                                                                                                                                                 |
| Complete Preview smoke suite                      | 39/39 passed                                                                                                                                                                                                                         |
| Cross-origin ceremony completion                  | proven at the unit level (`webauthn.test.ts`, 13/13 — a ceremony begun on the app origin whose finish HTTP request arrives on the apex is rejected) combined with live proof the public host 404s `/api/auth/**` entirely regardless |

## 3. Production live validation (post-deploy) — PRODUCTION LIVE HTTP

| Check                                       | Result                                                                                             |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| RP ID in the app-host response              | exactly **`crawlpact.com`** — unchanged from before Stage C, never narrowed to `app.crawlpact.com` |
| `POST /api/auth/register/begin` on app host | `200`                                                                                              |
| `POST /api/auth/login/begin` on app host    | `200`                                                                                              |
| `POST /api/auth/register/begin` on apex     | `404`                                                                                              |
| `POST /api/auth/login/begin` on apex        | `404`                                                                                              |
| Full `pnpm run smoke:production`            | **43/43 passed**                                                                                   |

## 4. Observation window (WORKERS TELEMETRY)

Post-deploy window, `2026-09-15T04:48:56Z`–`05:19:00Z` (~30 minutes; re-confirmed stable via a
fresh `pnpm run smoke:production` — 43/43 — at `05:39Z`, roughly an hour after deploy, after a
session interruption):

| Metric                                            | Result                                             |
| ------------------------------------------------- | -------------------------------------------------- |
| Worker invocations (`workersInvocationsAdaptive`) | 223 requests, **0 errors**, `success` status only  |
| Zone-wide 5xx (`edgeResponseStatus_geq: 500`)     | **zero rows**                                      |
| `crawlpact.com` status breakdown                  | 200 ×22, 301 ×7, 308 ×15, 400 ×2, 403 ×2, 404 ×145 |
| `app.crawlpact.com` status breakdown              | 200 ×6, 403 ×2, 404 ×30                            |
| `www.crawlpact.com`                               | 301 ×3                                             |

The elevated 404 counts (145 apex, 30 app host) reflect this session's own extensive live
ceremony-origin validation calls (`register/begin`/`login/begin` against both hosts, repeatedly)
plus ordinary bot/crawler traffic over the longer-than-usual window. The small `403` counts (2 per
host) are consistent with expected `FORBIDDEN` rejections (CSRF/webauthn-ceremony-origin checks)
or ordinary bot probing — not a new error class, and not paired with any 5xx or exception signal.
No material 5xx or exception spike, no redirect-loop signature, no host-boundary bypass.

## 5. Real-credential owner-observed gate — NOT PERFORMED BY THIS SESSION

The master directive requires, before declaring Stage C fully done: "perform owner-observed live
validation using a real passkey" — an existing passkey authenticates on the app host, a newly
created passkey registers and immediately authenticates on the app host, credential management
remains functional, no existing credential is deleted. **This session has no real physical
authenticator device and no way to drive a real browser+authenticator ceremony** — every check in
§2–§3 above is either a unit-level cryptographic proof (a real _software_ authenticator via
`virtual-authenticator.ts`) or a live HTTP check of the ceremony-begin endpoint's host-boundary
behavior, neither of which is OWNER-OBSERVED evidence. This is recorded honestly as an **open,
outstanding item for the product owner to perform directly** — not fabricated, not silently
skipped. Until it is performed, Stage C's code-level and infrastructure-level correctness is
proven, but the full directive-required completion bar for Stage C is not yet met.

## 6. Scope discipline

`WEBAUTHN_RP_ID` was never touched — confirmed unchanged (`crawlpact.com`) both in source
(`wrangler.jsonc`) and live in the Production response above. `getTrustedOrigins()` (`origin.ts`)
was not modified — the apex remains fully trusted for CSRF and general request classification;
only the WebAuthn-specific ceremony-origin rule narrowed. No session/cookie/Paddle/Cloudflare-
config change. No database migration. No existing credential was deleted or modified by this
change — it governs only where a _new_ ceremony may begin.

## Gate

```
PHASE 4 STAGE C — WEBAUTHN FINALIZATION PASS (code/infrastructure) ✅
PHASE 4 STAGE C — REAL-CREDENTIAL OWNER GATE — OUTSTANDING (owner action required)
```
