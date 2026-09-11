# Phase 4 Readiness Report

Status as of 2026-09-10, immediately following PR #173's Production compatibility deployment;
updated 2026-09-11 with the owner's completed manual validation and this session's independent
technical corroboration of it. This report supersedes the **status** claims of every earlier
Phase 1–3 document where they conflict — it does not rewrite or remove any historical evidence.

## A. Verdict

```
BLOCKED_PENDING_EXTERNAL_VALIDATION
```

(superseded from `BLOCKED_PENDING_OWNER_VALIDATION`, recorded 2026-09-10; corrected from a
transient `BLOCKED_PENDING_EXTERNAL_CONFIGURATION` framing, 2026-09-11 — the repository's only
pre-existing status term, from `PHASE_3_COMPLETION_REPORT.md`, described a _configuration_ defect;
what remains here is uncompleted _validation_ because the required live session or external
tooling was unavailable to this session, not a confirmed configuration problem. Neither
`BLOCKED_PENDING_LIVE_VALIDATION` nor `BLOCKED_PENDING_EXTERNAL_VALIDATION` existed anywhere in
this repository before now — this is a deliberate, narrow addition to the status vocabulary, not a
pre-established term being reused.)

Three distinct things are true at once, and this report keeps them distinct rather than
collapsing them into a single "done":

```
OWNER MANUAL VALIDATION — COMPLETE
  The owner reports completing new passkey registration and Google Sign-In on the app host.

TECHNICAL CORROBORATION — COMPLETE
  This session independently cross-checked that report against a read-only, aggregate-only,
  PII-free production D1 query (Section I, J) and found real, timestamped evidence consistent
  with it: a new passkey credential, a new Google OAuth linkage, no anomalies, nothing deleted.

LIVE/AUTOMATED VALIDATION — STILL PENDING
  Cookie-isolation and sibling-origin-CSRF proof have no D1-observable consequence at all — no
  amount of database inspection can substitute for actually observing them, and neither browser
  automation nor a direct owner observation occurred this pass. Google Search Console, GA4,
  Clarity, and CrUX verification remain entirely unverified — no tooling for any of them is
  connected to this session. Live Paddle checkout, recovery, authenticated app/admin smoke, and
  continuation flows were not attempted (Sections H, M, N).
```

**Technical corroboration is not the same as independent live proof, and this report does not
claim otherwise.** Do not upgrade this verdict to `PASS — PHASE 4 READY` merely because Paddle is
approved and the owner's manual work is done — the "still pending" tier above is still genuinely
open, for reasons of tooling access and observability, not doubt about the owner's report.

**Phase 4 has not started.** No apex→app redirect, CTA change, or traffic-migration switch was
enabled by this pass.

## B. Final Production Git SHA

```
b23e176849dcbb11b4abe9aa2184084c31a2ed1b
```

Squash-merge of PR #173 into `main`. Tree-verified identical to the Preview-tested candidate
(`2a2d15a8b966d1cf915ab1a064d1cc8ba7c471e9`) before deployment — `git diff 2a2d15a b23e176 --stat`
returned empty, and both commits' tree hash is `c6b47f8f6c3c2c0907446e1255707b758490fafe`.

## C. Worker deployment/version

```
Deployment: 8eacde5b-46b9-4c3f-92be-9d3c63de43fc
Version:    a73071e7-afe8-465a-a4cf-fee0237cb5f3
Deployed:   2026-09-10T14:36:46Z
```

Deployed via `deploy-production.yml` (`workflow_dispatch`, typed `DEPLOY PRODUCTION` confirmation,
ancestor check, CI-succeeded-for-this-exact-SHA check, all passed) — run
[34489405944](https://github.com/rmtlbandara/CrawlPact/actions/runs/34489405944), conclusion
`success`.

## D. Rollback target

```
Deployment: b0dfdff2-03da-4bbe-8403-aadf755a1851
Version:    5aacab1e-4e29-46ca-8f0c-886ee1f9794c
Corresponds to commit: 011b939 (previous production commit)
```

No persistent-state (D1/KV/R2) change was introduced by this deployment — PR #173 is
configuration/routing/reconciliation only, confirmed by its diff — so Worker rollback to this
target remains safe if ever needed.

## E. Preview evidence

Deployed to Preview first (`deploy-preview.yml`, `workflow_dispatch` with explicit
`commit_sha=2a2d15a`), confirmed built from the exact PR #173 SHA. Live-validated before
Production: the `/for/*`/`/research/*` alias fix (all four alias forms → single clean canonical
redirect, no malformed `.../index.html/` target), general non-regression (`/`, `/sign-in`,
`/about/`, `/app`, `/admin`, `/robots.txt` all correct), and the corrected
`PUBLIC_APP_URL=https://app.preview.crawlpact.com` live on the deployed Preview Worker. The
workflow's own build/migrate/seed/deploy/binding-verification/smoke-test/Lighthouse-budget steps
all passed. Full detail in the conversation record; not duplicated here.

## F. Cloudflare hostname matrix

| Hostname                             | Classification                | State                                                                                                                                                                                   |
| ------------------------------------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crawlpact.com`                      | PUBLIC                        | Live, canonical, unchanged                                                                                                                                                              |
| `app.crawlpact.com`                  | APP                           | Live, Custom Domain attached to `crawlpact-web`, Paddle-approved                                                                                                                        |
| `www.crawlpact.com`                  | REDIRECT_ONLY                 | 301 → apex, unchanged                                                                                                                                                                   |
| `preview.crawlpact.com`              | PREVIEW                       | Live, Custom Domain attached to `crawlpact-web-preview`                                                                                                                                 |
| `e2e-fixture.crawlpact.com`          | Test infrastructure only      | Unrelated to production app, unchanged                                                                                                                                                  |
| `<account>.workers.dev` (production) | **unclassified — still open** | Still enabled; disabling it was explicitly held for owner sign-off, not included in PR #173. Redundant exposure, not a broken security boundary, but should be resolved before Phase 4. |
| `app.preview.crawlpact.com`          | Candidate only, not attached  | Corrected to a WebAuthn-valid hostname this pass; no DNS/Custom Domain exists                                                                                                           |

## G. Paddle Approved evidence

Independently confirmed via the Paddle API (not just the owner's dashboard screenshot),
re-verified again immediately after this Production deployment to confirm the deploy didn't
disturb it:

```
crawlpact.com      chedom_01kyfnvdzbbvxx40vr7b3hvz98   approved   (unchanged since 2026-07-26)
app.crawlpact.com  chedom_01m24mn1cqys7mcn80rgt6t4t2   approved   updated_at 2026-09-10T11:10:42Z
```

Both show `payment_method_verification.apple_pay.status: "verified"`. Not resubmitted, not
touched.

## H. Paddle checkout evidence

**Not attempted this pass.** Opening a live Paddle checkout overlay on `app.crawlpact.com`
requires browser automation (none connected to this session — confirmed by direct tool-catalog
search) or the owner's own live interaction. Server-side price resolution (`plan-mapping.ts`) is
unchanged by PR #173 and was not touched. **Blocks Phase 4** per the directive's own gate list —
genuinely not performed, not assumed passing.

## I. Google configuration and E2E evidence

No Google Cloud/OAuth Console MCP or equivalent tooling is connected to this session (confirmed
by direct probe both 2026-09-10 and 2026-09-11). This session cannot directly read Google's
Authorized JavaScript Origins list.

**Owner-reported, technically corroborated (2026-09-11)**: the owner reports completing the app
origin's Google configuration and a real Google Sign-In against `app.crawlpact.com`. Independent
verification via a read-only, aggregate-only, PII-free query against production D1
(`oauth_accounts` table — only `id`, `created_at`, `updated_at`, `last_used_at` columns read, never
`email`):

```
existing linkage:  created 2026-09-07T11:10:23Z (pre-migration) — last_used_at refreshed 2026-09-11T02:09:54Z
new linkage:        created 2026-09-11T02:15:28Z
```

Google's own client only returns a credential when the calling page's origin is on its Authorized
JavaScript Origins allowlist — a real credential exchange completing (evidenced by these new/
refreshed rows) is strong circumstantial proof the app origin is correctly authorized. This is
**inference from an observed consequence, not a direct read of Google's own configuration** — D1
also cannot distinguish which hostname (apex vs. app) initiated either event, since session/OAuth
rows don't record the request's Host header. Recorded as corroborated, not proven. A direct
Google Console/API confirmation remains the more rigorous close-out, and GSC/GA4/CrUX (Sections
O–Q) remain entirely unverified regardless.

## J. WebAuthn evidence

`WEBAUTHN_RP_ID=crawlpact.com` reconfirmed live on the deployed production Worker, unchanged.
Origin-pinning code (`auth/webauthn.ts`) untouched since Phase 2. Full unit + security suites
green (677/677, 45/45 — re-run fresh 2026-09-11 against `main`). The existing pre-migration
passkey continuity PASS (real human test, Phase 3) is carried forward unchanged, since nothing
WebAuthn-relevant changed — the owner was not asked to repeat it.

**New-passkey registration + authentication — owner-reported, technically corroborated
(2026-09-11)**: independent verification via the same read-only D1 method (only `id`,
`created_at`, `last_used_at` read from `passkey_credentials` — never `credential_id` or
`public_key`):

```
new credential:        created 2026-09-11T02:14:27Z  (exactly 1 new row)
pre-existing credential used: last_used_at 2026-09-11T02:10:33Z (~4 minutes earlier)
```

No credential was deleted; the count of pre-existing credentials is unchanged. This sequence — sign
in on the existing credential, then register a new one four minutes later — is exactly the
technical shape RISK-036's stated acceptance criterion asks for. **This closes RISK-036's
new-passkey criterion.** Cross-origin ceremony rejection remains proven only by the existing
automated test suite (2 real-authenticator replay tests, Phase 2) — not re-attempted live this
pass, since nothing in the mechanism changed and repeating it would only re-prove an unchanged
code path.

## K. Session-cookie evidence

**Still not independently observed live** — D1 cannot see cookie attributes (they never reach
persistent storage), and no browser automation is connected. The owner did not report a direct
cookie inspection. Source-level guarantee re-read and confirmed unchanged:
`buildSessionCookie`/`buildClearedSessionCookie` in `apps/web/src/lib/auth/session.ts` remain
host-only (`Path=/`, `HttpOnly`, `Secure` outside local, `SameSite=Lax`, no `Domain` attribute) —
zero lines of that file have changed since Phase 2. "Expected by code reading" and "verified live"
are kept distinct, per this repo's own established practice. **Still blocks Phase 4's own stated
RISK-036 acceptance criteria** — closing it needs either browser automation or a direct
owner-supplied observation (e.g., a devtools screenshot of cookie attributes with the value
redacted).

## L. CSRF live evidence

Server-level integration suite (`csrf.integration.test.ts`, 4 sibling-origin tests) passes,
unchanged, re-confirmed green 2026-09-11. **Live proof against a real authenticated session was
not performed** — same limitation as Section K: no D1-observable proxy exists for a rejected
cross-origin request (it never persists anywhere), and no browser automation is connected.
**Still blocks Phase 4's own stated RISK-036 acceptance criteria.**

## M. Recovery/authenticated-app evidence

**Not performed this pass.** Recovery-code validation and authenticated `/app`/`/admin` smoke
both require a real authenticated session (browser automation unavailable, or the owner's live
interaction). Nothing in PR #173 touches recovery or authenticated-app code paths.

## N. Audit/pricing continuation evidence

**Not performed this pass.** The public-audit-to-app-sign-in continuation flow and the
pricing→sign-in→billing flow both require a real, live, multi-step browser session. Nothing in
PR #173 touches continuation, pricing, or billing code paths — Phase 2/3's existing evidence for
these flows is unchanged and carried forward, but not independently re-proven live this pass.

## O. SEO/GSC

**Cannot verify.** No Search Console MCP/API tooling connected (confirmed by probe). Does not
block Phase 4 on its own (SEO hygiene, not a security/auth gate) but should be resolved before
customer traffic moves.

## P. GA4/Clarity

**Cannot verify with connected tooling this pass** (no GA4/Clarity API access). Source-level
guarantee unchanged: `AuthLayout` (used by both `/` and `/sign-in` on the app host) has no GA/
Clarity import, structurally — unmodified by PR #173.

## Q. CrUX/Lighthouse

CrUX: not queried this pass (no connected tooling). Lighthouse: the Preview deploy's own budget
check ran and passed against this exact SHA (Section E) — no material performance regression
introduced by this reconciliation's changes (route-registry.ts logic and env-schema validation
are both effectively invisible to page-load performance).

## R. Monitoring/observability

**Not assessed or changed this pass.** Phase 3 previously found Workers Observability/Logs
disabled; this pass neither enabled it nor built an alternative. This remains an open item for
Phase 4 planning — Phase 4 must not begin with zero cutover-monitoring signal, but implementing
that is a distinct, unauthorized-this-pass change, not something to do incidentally here.

## S. Quality/CI

PR #173 (`b23e176`): fresh CI on `main` — first attempt had 1 job
(`Chromium E2E + accessibility smoke`) fail with timeout errors in `home.spec.ts`'s passkey
setup helpers, unrelated to the diff; isolated rerun came back fully green. PR #174 (docs-only,
`324eefd`): fresh CI failed twice more with the identical Miniflare "Worker code hung" 500
signature across unrelated spec files (impossible to be a real regression — the diff was markdown
only) — third rerun green. Merged both via the repo's own squash-merge convention.

**2026-09-11 re-run against current `main` (`324eefd`)**: format ✓, lint ✓ (0 warnings),
typecheck ✓ (0 errors, 553 files), unit 677/677 (52 files), security 45/45 (8 files), db:validate
✓ (56 tables). Integration hit the same pre-existing local Miniflare port-exhaustion pattern on
retry (`EADDRNOTAVAIL`/`fetch failed`/`dispose is not a function`, different unrelated files each
attempt) — a local-machine resource characteristic, not a regression (zero application code
changed this pass); CI has already run this identical tree's integration suite clean multiple
times in an isolated container, treated as authoritative for that suite.

**Security headers, live-checked 2026-09-11**: CSP, HSTS, X-Content-Type-Options,
Referrer-Policy, Permissions-Policy, X-Frame-Options all present and correct on the public
homepage, the app shell, and `/sign-in`; the latter two additionally carry
`X-Robots-Tag: noindex, nofollow, noarchive` and `Cache-Control: private, no-store` (vs. the
public page's `public, max-age=0, must-revalidate`). No header silently dropped by Worker-first
routing. `Cross-Origin-Opener-Policy` remains absent everywhere (see Section T).

**`/pay`/webhook, live-checked 2026-09-11**: `/pay` → 200; webhook GET → 404, unsigned POST →
403 (rejected). A matching `invalid_paddle_signature` security-event row
(`2026-09-10T14:36:56Z`) is this session's own unsigned test request, not an anomaly.

## T. Residual non-blocking risks

- **COOP/Google FedCM compatibility**: no browser automation is connected, so this session cannot
  run its own Chromium/Safari/FedCM-off matrix. The owner's reported Google Sign-In (Section I)
  completed without a mentioned failure, which is evidence-favoring "no COOP header needed" rather
  than a closed decision — a genuinely blocking finding would require an actual reported failure,
  which hasn't occurred. Recorded as non-blocking, not silently dropped; a real browser test
  remains the more rigorous close-out whenever tooling allows it.
- Production `workers.dev` remains enabled — redundant exposure, not a broken boundary; held for
  explicit owner sign-off (Section F).
- `WEBAUTHN_RP_ORIGIN` legacy field remains bound and unread for verification — harmless while
  retained, decision on removal deferred to the Phase 4 rollback-window.
- `/dev/components` runtime-protection finding from Phase 1 was not re-checked this pass
  (unrelated to the app-subdomain migration specifically) — should be tracked to closure
  independently rather than silently dropped.
- Cloudflare Managed WAF is unavailable on this account's Free plan (a cost/plan decision, not a
  technical gap this migration created or can close).
- The Browser Integrity Check exception for `app.crawlpact.com` remains exactly as Paddle approved
  it — intentionally not touched. Recorded as a **non-blocking post-migration hardening item**:
  reassess only after Phase 4 cutover has completed successfully and the application has
  stabilized, preferring to test restoration of BIC on `/sign-in` first (see
  `docs/deployment/CLOUDFLARE_CONFIGURATION.md`'s dedicated section).

## U. Exact Phase 4 switch inventory

Not executed this pass — listed for future planning only:

- Header "Sign in" / "Create account" CTA destinations
- Pricing-page CTAs
- Public audit CTA
- Email/notification app-links
- `/sign-in`, `/app`, nested legacy `/app/*` route retirement/de-prefixing
- API wrong-host retirement
- Google apex-origin eventual cleanup (once app-origin-only is proven stable)
- WebAuthn migration-window narrowing (removing dual-origin compatibility)
- Stale environment/config cleanup (`WEBAUTHN_RP_ORIGIN`, etc.)
- The permanent apex→app redirect itself

## Summary

Paddle approval closed 2026-09-10 — independently confirmed via API, not just the owner's
screenshot — and PR #173 (the alias fix, env-schema tightening, and Preview WebAuthn correction)
went live in Production, validated on both apex and app hostnames with the exact same rigor used
throughout this migration. A follow-up docs-only PR (#174) recorded that state in Git history. The
Cloudflare BIC exception that unblocked Paddle was deliberately left untouched throughout, as
instructed, and is documented as an intentional, load-bearing configuration.

On 2026-09-11, the owner reported completing the remaining manual-required validation (new passkey
registration, Google Sign-In). This session did not accept that on trust: it independently
cross-checked it against a read-only, aggregate-only, PII-free production D1 query and found real,
timestamped technical evidence — a new passkey credential and a new Google OAuth linkage, both
inside the same tight real-activity window, no anomalies, nothing deleted. That closes RISK-036's
new-passkey criterion and materially strengthens confidence in Google's app-origin configuration,
though it stops short of a direct read of Google's own console state.

What remains is a short, specific, already-enumerated list: Google Search Console, GA4, Clarity
API, and CrUX verification (no connected tooling — genuinely unverifiable this pass, not skipped),
live cookie-isolation and sibling-origin CSRF proof (no D1-observable proxy exists for either, and
no browser automation is connected), live Paddle checkout opening, recovery validation,
authenticated app/admin smoke, and audit/pricing continuation flows (all require either browser
automation or a live session neither available nor owner-reported this pass), plus the
already-known non-blocking items (`workers.dev`, COOP, monitoring). Phase 4 has not started and
will not start until the genuinely blocking items above close.
