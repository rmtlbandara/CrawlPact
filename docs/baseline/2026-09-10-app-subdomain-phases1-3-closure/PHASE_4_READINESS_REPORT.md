# Phase 4 Readiness Report

Status as of 2026-09-10, immediately following PR #173's Production compatibility deployment;
updated 2026-09-11 with the owner's completed manual validation and this session's independent
technical corroboration of it; updated again 2026-09-11 (final pre-Phase-4 pass) with the
remainder of the owner's live validation round (cookie isolation, CSRF, Paddle checkout, recovery,
admin, continuation, pricing/billing) and one HIGH-PRIORITY security finding surfaced during
corroboration. This report supersedes the **status** claims of every earlier Phase 1–3 document
where they conflict — it does not rewrite or remove any historical evidence. Full evidence for the
2026-09-11 final pass: `docs/baseline/2026-09-11-app-subdomain-final-pre-phase4/`.

## ⚠ HIGH-PRIORITY SECURITY FINDING (owner action required, not applied this pass)

While independently corroborating the owner's reported recovery-authentication test, a read-only,
PII-free production D1 query found that the test account's recovery-code batch (created
`2026-09-11T02:14:27Z`, likely the batch shown in the screenshots referenced during this
validation round) has **never been regenerated** — it is the only batch ever recorded for that
account, and 9 of its 10 codes remain valid and unused right now. If those codes were shown in a
screenshot, they are currently still usable by anyone who saw it. **This session did not and will
not regenerate codes on the owner's behalf** — see
`docs/baseline/2026-09-11-app-subdomain-final-pre-phase4/OWNER_ACTION_QUEUE.md` item 1 for the
full evidence and the exact action needed (regenerate via the normal in-app flow, before Phase 4).

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
  The owner reports completing new passkey registration, Google Sign-In, cookie-isolation
  inspection, sibling-origin CSRF testing, a live Paddle checkout open/cancel, recovery-code
  generation and redemption, authenticated app and admin smoke, public-audit continuation, and
  pricing-to-billing continuation — the full validation round across two owner sessions.

TECHNICAL CORROBORATION — COMPLETE where a technical proxy exists
  This session independently cross-checked what has a database or API footprint: new passkey
  credential (Section J), new Google OAuth linkage (Section I), Paddle checkout-domain approval
  unchanged (Section H), admin route names verified to exist in the codebase (Section M). One
  HIGH-PRIORITY finding surfaced doing this: the recovery-code batch used in testing shows no
  evidence of ever being regenerated (see the callout at the top of this report).

LIVE/AUTOMATED VALIDATION — STILL PENDING (genuinely, not by oversight)
  Cookie-isolation and sibling-origin-CSRF have no D1-observable consequence at all, live Paddle
  checkout UI/recovery UI/admin UI/continuation flows have no technical proxy beyond what's noted
  above — none of these were independently re-observed by browser automation, because none is
  connected to this session. Google Search Console, GA4, Clarity, and CrUX verification remain
  entirely unverified — no tooling for any of them is connected to this session either.
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

**OWNER-OBSERVED (2026-09-11)**: the owner reports opening a live Solo/yearly checkout from
`app.crawlpact.com/app/billing` — app checkout API 200, Paddle transaction/checkout init 201,
correct `$89/year` presentation, no domain-approval error, cancelled before payment, account
remained Free, no payment completed. This session did not observe it directly (no browser
automation connected), but independently re-confirmed via the Paddle API that
`app.crawlpact.com`'s checkout-domain approval is unchanged (`chedom_01m24mn1cqys7mcn80rgt6t4t2`,
still `approved`) — a "domain not approved" error would have been structurally impossible to avoid
otherwise. Server-side price resolution (`plan-mapping.ts`) is unchanged by PR #173/#174/#175.
**Recorded as owner-observed, corroborated by Paddle-domain-state; not independently browser-tested
this pass.**

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

**OWNER-OBSERVED (2026-09-11)**: the owner reports directly inspecting the real cookie on an
authenticated `app.crawlpact.com` session and confirming `HttpOnly`, `Secure`, `Path=/`,
`SameSite=Lax`, host-only scope (no `Domain=crawlpact.com`), and that a subsequent apex request did
not send `crawlpact_session`. This session did not observe it directly (no browser automation
connected) and no cookie value was requested, printed, or stored. Source-level guarantee re-read
and confirmed unchanged: `buildSessionCookie`/`buildClearedSessionCookie` in
`apps/web/src/lib/auth/session.ts` remain host-only, zero lines changed since Phase 2 — the
owner's report matches exactly what the source guarantees. **Recorded as owner-observed,
corroborated by unchanged source; not independently re-observed by this session.** This closes
RISK-036's cookie-isolation acceptance criterion at the owner-validation tier.

## L. CSRF live evidence

**OWNER-OBSERVED (2026-09-11)**: the owner reports a real authenticated `PATCH /api/account`
tested three ways — app target + app Origin → 200; app target + apex Origin → 403; app target +
`https://example.com` Origin → 403 — exactly the arrival-origin-must-equal-validated-origin
invariant `same-origin.ts` implements (never a broad "any trusted CrawlPact origin" allowlist).
Server-level integration suite (`csrf.integration.test.ts`, 4 sibling-origin tests) re-confirmed
green 2026-09-11, asserting the identical pattern. **Recorded as owner-observed, corroborated by
unchanged automated coverage; not independently re-observed by this session** (no D1-observable
proxy exists for a rejected cross-origin request — it never persists anywhere). This closes
RISK-036's CSRF-isolation acceptance criterion at the owner-validation tier.

## M. Recovery/authenticated-app evidence

**OWNER-OBSERVED (2026-09-11)**, with one HIGH-PRIORITY finding surfaced during corroboration —
see the callout at the top of this report and `docs/baseline/2026-09-11-app-subdomain-final-pre-phase4/OWNER_ACTION_QUEUE.md`.
The owner reports generating recovery codes, redeeming one, and completing customer app smoke
(`/app`, `/app/workspace`, `/app/domains`, `/app/groups`, `/app/notifications`, `/app/billing`,
`/app/account` all rendered, 200s, no redirect loops) plus admin smoke (`/admin`, `/admin/health`,
`/admin/domains`, `/admin/analytics`, `/admin/audit-logs` all rendered for an admin-capable
session; an ordinary session got 302 on `/admin`). Independent D1 check: a real recovery-code
batch exists (1 batch, 1/10 used, matching "redeemed one"), and — critically — **shows no evidence
of ever being regenerated**, meaning if this batch was shown in a screenshot, those codes remain
live right now. Admin route names were verified to genuinely exist in the codebase
(`ls apps/web/src/pages/admin/`), not assumed from the owner's description. Full detail:
`docs/baseline/2026-09-11-app-subdomain-final-pre-phase4/TEST_EVIDENCE.md` and
`VERIFICATION_MATRIX.md`.

## N. Audit/pricing continuation evidence

**OWNER-OBSERVED (2026-09-11), not independently corroborated**. The owner reports completing both
the public-audit continuation flow (opaque continuation carried from apex to app sign-in,
confirmation shown, saved, no replay possible) and the pricing→auth→billing flow (plan/interval
preserved exactly through app sign-in, no auto-checkout). `audit_continuations` currently has 0
rows account-wide — inconclusive, not a negative signal: the daily retention cron deletes
consumed/expired rows and already ran once in this window, so an empty table is consistent with
"created, consumed, then swept." No D1 table captures in-flight plan/interval query-parameter
state by design. Existing automated coverage for both flows (continuation replay/expiry tests,
plan/interval allowlist, `isSafeRelativeRedirect`, server-side price re-resolution) is unchanged
and re-confirmed green. **Recorded as owner-observed only** — genuinely no technical proxy exists
either way.

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

**Assessed in detail 2026-09-11, not changed** — full findings and options in
`docs/baseline/2026-09-11-app-subdomain-final-pre-phase4/OBSERVABILITY_READINESS.md`. Confirmed
live: 0 account-wide Logpush jobs, Worker-level `logpush: false`, no tail consumers, no Workers
Observability configuration present. There is currently no automated signal for 5xx, Worker
exceptions, auth/WebAuthn/CSRF failure spikes, or webhook failures. Enabling Workers Observability
is a real Production configuration change with its own cost/retention tradeoffs on this account's
Free plan — prepared as an option, not applied, pending explicit owner decision (see
`OWNER_ACTION_QUEUE.md` item 3). **Phase 4 must not begin with zero cutover-monitoring signal —
this remains a genuinely open item, not resolved by this pass's assessment alone.**

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

- **This is a blocking, not non-blocking, item, listed here only because it fits nowhere else in
  the A–U structure**: the exposed-recovery-code finding (see the callout at the top of this
  report and `OWNER_ACTION_QUEUE.md` item 1) must be resolved by the owner before Phase 4.
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

On 2026-09-11, in a second round, the owner reported completing the remainder of the manual
validation set: live cookie-isolation inspection, authenticated sibling-origin CSRF testing, a
live Paddle checkout open/cancel, recovery-code generation and redemption, authenticated app and
admin smoke, public-audit continuation, and pricing-to-billing continuation. This session
corroborated everything with a technical footprint (Paddle domain state unchanged, admin routes
genuinely exist, automated CSRF/session-cookie source guarantees unchanged) and was honest about
what has none (cookie/CSRF live proof, checkout/recovery/admin/continuation UI flows — no browser
automation is connected, so none of these were independently re-observed).

Doing that corroboration surfaced a genuine finding, not a paperwork gap: the recovery-code batch
used in this round's testing has never been regenerated, and 9 of its 10 codes remain valid right
now. If those codes appeared in a screenshot during testing, they are currently usable by anyone
who saw it. This is recorded as a HIGH-PRIORITY owner action, not buried in a residual-risks list.

What remains open: Google Search Console, GA4, Clarity API, and CrUX verification (no connected
tooling — genuinely unverifiable this pass, not skipped); live browser re-observation of
cookie-isolation, CSRF, checkout, recovery, admin, and continuation flows (owner-observed and
partially corroborated, but not independently proven by this session); the recovery-code
regeneration action above; and the already-known non-blocking items (`workers.dev` disposition,
COOP, monitoring — the last of which is a genuinely open readiness gap, not merely non-blocking
cosmetic follow-up). Phase 4 has not started and will not start until the genuinely blocking items
above close.
