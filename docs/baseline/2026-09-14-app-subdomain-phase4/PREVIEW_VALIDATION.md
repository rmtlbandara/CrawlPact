# Phase 4 Stage A — Preview Validation

Status 2026-09-14. Owner-approved, Preview-only infrastructure change:
`app.preview.crawlpact.com` attached as a second real Cloudflare Custom Domain for
`crawlpact-web-preview`, completing the two-origin topology Stage A's redirect logic needs to
validate against (Preview previously had only one Custom Domain — see
`PHASE_4_STAGE_A_STATUS.md`'s "Preview deployment attempt found a genuine, pre-existing
infrastructure gap" for how this was discovered).

## Deployment record

```
PR #180 exact head deployed: a808f0f8d7bd1e1b51c49e5898354151a27e0953
Preview deployment ID:       5d9d8270-c416-41f9-85df-d86800ee1734
Preview Worker version ID:   7e3e8582-4793-499f-9779-871e258929f9
Deployed:                    2026-09-14T07:21:11Z
```

## Custom Domain provisioning — CLOUDFLARE API evidence

`wrangler deploy` auto-provisioned the second Custom Domain from the `env.preview.routes` config
change alone — no manual Cloudflare API call was needed. Confirmed via a live
`GET /accounts/{id}/workers/domains` read:

| Hostname                    | Service                 | Cert ID                                | Enabled |
| --------------------------- | ----------------------- | -------------------------------------- | ------- |
| `preview.crawlpact.com`     | `crawlpact-web-preview` | `79dc2c6d-3e21-40ba-86de-f4d79b9e8856` | true    |
| `app.preview.crawlpact.com` | `crawlpact-web-preview` | `c0c6926a-d83b-44c2-a8e3-125531e72867` | true    |

Both have their own distinct, real TLS certificate — genuinely separate, healthy Custom Domains,
not a wildcard or shared cert.

## HTTPS health — LIVE HTTP evidence

```
GET https://preview.crawlpact.com/          -> 200
GET https://app.preview.crawlpact.com/      -> 200
```

Both confirmed directly via `curl`, independent of the deploy workflow's own smoke test.

## Full two-origin validation matrix

| #   | Check                                                                                                     | Method                     | Result               | Evidence                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | --------------------------------------------------------------------------------------------------------- | -------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Public Preview `/` renders homepage, remains noindex, no redirect                                         | LIVE HTTP                  | **PASS**             | `GET /` → 200; no redirect                                                                                                                                                                                                                                                                                                                                                                                             |
| 2   | `/sign-in` apex → app, 307, one hop                                                                       | LIVE HTTP                  | **PASS**             | `Location: https://app.preview.crawlpact.com/sign-in`; follow-redirect (`curl -L`) resolves 200, no loop                                                                                                                                                                                                                                                                                                               |
| 3   | `/app` apex → app, 307, `/app` prefix preserved                                                           | LIVE HTTP                  | **PASS**             | redirects to `https://app.preview.crawlpact.com/app`                                                                                                                                                                                                                                                                                                                                                                   |
| 4   | `/app/domains/:id?tab=history` apex → app, full path + query preserved                                    | LIVE HTTP                  | **PASS**             | redirects to `https://app.preview.crawlpact.com/app/domains/abc123?tab=history`                                                                                                                                                                                                                                                                                                                                        |
| 5   | `/admin` apex → app, 307                                                                                  | LIVE HTTP                  | **PASS**             | redirects to `https://app.preview.crawlpact.com/admin`                                                                                                                                                                                                                                                                                                                                                                 |
| 6   | Sign-in query allowlist: `continuation` preserved                                                         | LIVE HTTP                  | **PASS**             | `?continuation=abc-123-test` forwarded verbatim                                                                                                                                                                                                                                                                                                                                                                        |
| 7   | Sign-in query allowlist: `plan`+`interval` preserved                                                      | LIVE HTTP                  | **PASS**             | `?plan=pro&interval=year` forwarded verbatim                                                                                                                                                                                                                                                                                                                                                                           |
| 8   | Sign-in query allowlist: unrecognized params dropped                                                      | LIVE HTTP                  | **PASS**             | `?utm_source=test&redirect_uri=https://evil.example` → redirects with no query at all                                                                                                                                                                                                                                                                                                                                  |
| 9   | App Preview `/sign-in` loads directly, no redirect back                                                   | LIVE HTTP                  | **PASS**             | 200, contains "Sign in with passkey"/"Create account"                                                                                                                                                                                                                                                                                                                                                                  |
| 10  | App Preview `/` does not serve public marketing HTML                                                      | LIVE HTTP                  | **PASS**             | app-shell content, distinct `<title>` from apex homepage                                                                                                                                                                                                                                                                                                                                                               |
| 11  | `APP_ONLY` API (`/api/domains`) rejected on public Preview                                                | LIVE HTTP                  | **PASS**             | 404, plain "Not Found" body (Worker-level rejection, confirmed distinct from a real handler's JSON error shape)                                                                                                                                                                                                                                                                                                        |
| 12  | `PUBLIC_ONLY` API (`/api/audit`, POST) rejected on app Preview                                            | LIVE HTTP                  | **PASS**             | 404                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 13  | Agency-logo `PUBLIC_ONLY` asset: real handler reached on apex                                             | LIVE HTTP                  | **PASS**             | apex returns an empty-body 404 (R2 object-not-found, real handler); app host returns the literal `"Not Found"` text (Worker-level rejection) — the two are distinguishably different, proving correct per-host routing, not just matching status codes                                                                                                                                                                 |
| 14  | Static Assets alias boundary on app host: `/about.html`, `/about/index.html` do not serve raw public HTML | LIVE HTTP                  | **PASS**             | both 308-redirect to the canonical apex URL, exactly like the pre-existing Phase 2 protection — confirmed against the real two-host topology, not only unit tests                                                                                                                                                                                                                                                      |
| 15  | App Preview noindex                                                                                       | LIVE HTTP                  | **PASS**             | `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet` on `/` and `/sign-in`                                                                                                                                                                                                                                                                                                                                          |
| 16  | GA4/Clarity absent on app Preview                                                                         | LIVE HTTP                  | **PASS**             | no `googletagmanager.com`/`clarity.ms` reference in `/` response body                                                                                                                                                                                                                                                                                                                                                  |
| 17  | Workers Logs receive events from both Preview hostnames                                                   | CLOUDFLARE API / TELEMETRY | **PASS**             | live telemetry query shows real events attributed to both `preview.crawlpact.com` and `app.preview.crawlpact.com` in the same window                                                                                                                                                                                                                                                                                   |
| 18  | No 5xx pattern since deployment                                                                           | CLOUDFLARE API / TELEMETRY | **PASS**             | 0 events with `status >= 500` in the 30-minute post-deploy window                                                                                                                                                                                                                                                                                                                                                      |
| 19  | No Worker-exception pattern since deployment                                                              | CLOUDFLARE API / TELEMETRY | **PASS**             | 52/52 events in the window are `level: "info"`; 0 non-info                                                                                                                                                                                                                                                                                                                                                             |
| 20  | No raw bearer-secret exposure                                                                             | CLOUDFLARE API / TELEMETRY | **PASS**             | only synthetic, non-secret test values used throughout (`fake-user-id`, `abc-123-test`, `abc123`) — none are real credentials; low-entropy values are correctly shown verbatim (they are not secrets — `continuation` IDs and `plan`/`interval` are documented non-sensitive semantic values, not bearer tokens), consistent with the already-established finding that only genuinely high-entropy values are redacted |
| 21  | `deploy-preview.yml`'s own smoke test (`pnpm smoke:preview`)                                              | CI                         | **PASS** (after fix) | see below                                                                                                                                                                                                                                                                                                                                                                                                              |

## `smoke-test.ts` fix (found by this exact deployment, not anticipated in advance)

The first deploy of this branch's Custom-Domain-attachment commit to Preview succeeded, but the
pre-existing `deploy-preview.yml` smoke-test step failed: it hardcoded `/sign-in` returning `200`
directly on the base URL — stale the instant Preview's own apex genuinely redirects there. Fixed
in `scripts/smoke-test.ts` (optional third `appBaseUrl` CLI argument; when present, `/sign-in`,
`/app`, and `/admin` are checked as redirects, the real content check moves to the app host, and
both directions of wrong-host `/api/*` rejection are added). `smoke:preview` now passes
`https://app.preview.crawlpact.com` as that argument; `smoke:production` is deliberately
unchanged (Production has not deployed Stage A). Verified directly: `smoke:preview` 39/39,
`smoke:production` 35/35 (unaffected).

## WebAuthn topology (SOURCE INSPECTION only — no live ceremony run)

`PUBLIC_APP_URL=https://app.preview.crawlpact.com`, `WEBAUTHN_RP_ID=preview.crawlpact.com` — the
app-preview hostname is a genuine subdomain of the RP ID (`app.preview.crawlpact.com` ends in
`.preview.crawlpact.com`), a valid registrable-domain-suffix match per the same contract already
proven for Production (`app.crawlpact.com` under RP ID `crawlpact.com`). Not changed by this
pass; `WEBAUTHN_RP_ID` was never touched. A real physical passkey ceremony against the new
two-host Preview topology was not run — not required for this gate (this doesn't change any
WebAuthn code path, only which real hostname `app.preview.crawlpact.com` resolves to), and no
existing E2E WebAuthn coverage runs against this exact live two-host Preview deployment (CI's
own E2E suite runs against a local single-origin dev server, not this live Preview instance).

## Remaining limitations, stated honestly

- No real authenticated end-to-end flow (real passkey registration/login, real agency-logo
  upload) was exercised against this live two-host Preview deployment — doing so was out of
  scope for a read-only, non-mutating validation pass and would require creating real test
  accounts/credentials on a shared Preview environment. The agency-logo fix (#13 above) is proven
  by distinguishing the two hosts' different rejection/handling behavior for the same path, plus
  the 6 dedicated unit tests already merged — not by a full real upload.
- CI's own Chromium E2E suite still runs against a local, single-origin dev server
  (`PUBLIC_APP_URL` equals `PUBLIC_SITE_URL` there) — it does not and cannot exercise this real
  two-host Preview topology. This live validation matrix is what actually proves the two-host
  behavior; CI proves the code doesn't regress the single-origin case.

## Verdict

```
PHASE 4 STAGE A — PREVIEW VALIDATION PASS
```

All 21 checks above pass. **Production Stage A has NOT been deployed.**
